// app/screens/odometer.tsx
// Fidget Frenzy – Odometer v0.9-dev
//
// FIX PASS: Engine loop must NOT restart on repeated flicks.
// FIX PASS: Braking must screech-to-halt (decel) and play screech reliably.
//
// Key changes:
// ✅ Drag is "armed" only after a short delay + larger movement threshold (prevents flick -> drag takeover)
// ✅ We never stop engine on touch begin
// ✅ Weak flicks do nothing (never stop engine)
// ✅ Brake: longer hard-stop window + higher minimum slide speed
// ✅ Brake sound: stop engine, wait 40ms, then play screech (iOS reliability)

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  LayoutChangeEvent,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FrameInfo,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import PremiumStage from "../../components/PremiumStage";
import GameHeader from "../../components/GameHeader";
import { frenzyTheme as t } from "../theme/frenzyTheme";
import {
  preloadSounds,
  playSound,
  playLoopPersistent,
  GlobalSoundManager,
} from "../../lib/soundManager";
import { APP_IDENTITY } from "../../constants/appIdentity";
import { useSettingsUI } from "../../components/SettingsUIProvider";

// ----------------------------------------------
// TUNING
// ----------------------------------------------

const TRACK_SCALE = 1.25;
const TRACK_AREA_SCREEN_RATIO = 0.56;

const TIRE_SIZE = 260;
const TIRE_VERTICAL_OFFSET = -32; // ✅ LOCKED PERFECT
const TIRE_RADIUS = TIRE_SIZE / 2;
const TIRE_HIT_SLOP = 44;

const CAR_WIDTH = 56;
const CAR_HEIGHT = 112;

const OVAL_RX = 0.246;
const OVAL_RY = 0.360;

const TRACK_SRC = require("../../assets/odometer/track.png");
const CAR_SRC = require("../../assets/odometer/car_red.png");
const TIRE_SRC = require("../../assets/odometer/tire.png");

const ENGINE_ID = "race-car";
const ENGINE_SRC = require("../../assets/sounds/race-car-long.mp3");

const BRAKE_ID = "race-car-brake";
const BRAKE_SRC = require("../../assets/sounds/race-car-brake.mp3");

const { height: SCREEN_H } = Dimensions.get("window");

const ODO_WORLD = {
  top: "#FFE7A6",
  mid: "#FFB547",
  bottom: "#FF7A1A",
};

const ODO_STAGE_SURFACE = "#36353A";

const CONFIG = {
  DAMPING_PER_SECOND: 0.88,
  OMEGA_STOP: 10,

  // Flick + boost
  MIN_FLICK_THRESHOLD: 240,
  BOOST_MULTIPLIER: 4.8,
  MAX_OMEGA: 1500,

  // Engine gating (frame-based)
  ENGINE_START_OMEGA: 240,

  MAX_OMEGA_FOR_FULL_SPEED: 1400,
  LAPS_PER_SECOND_AT_MAX: 0.9,
  MILES_PER_SECOND_AT_MAX: 3.5,

  // Brake: hold still while spinning
  BRAKE_HOLD_SEC: 0.28,
  BRAKE_STILL_PX: 14,
  BRAKE_MIN_OMEGA: 130,

  // Braking feel: longer + more visible decel
  BRAKE_HARD_STOP_SEC: 5.25,
  BRAKE_MIN_SLIDE_SPEED: 0.45, // ensures visible slide even at moderate omega

  // Drag vs flick disambiguation (THIS is the “don’t restart engine” fix)
  DRAG_ARM_DELAY_MS: 70, // flick happens before this; drag cannot arm yet
  DRAG_START_PX: 26,     // big enough that a flick won’t accidentally arm drag
};

const LAPS_PER_DEGREE = 1 / 360;
const MILES_PER_LAP =
  CONFIG.MILES_PER_SECOND_AT_MAX / CONFIG.LAPS_PER_SECOND_AT_MAX;

const TRACK_AREA_HEIGHT = SCREEN_H * TRACK_AREA_SCREEN_RATIO;

type TrackPoint = { x: number; y: number };

const createOvalPoints = (count: number): TrackPoint[] => {
  const pts: TrackPoint[] = [];
  const cx = 0.5;
  const cy = 0.5;

  for (let i = 0; i < count; i++) {
    const tt = (i / count) * Math.PI * 2;
    pts.push({
      x: cx + OVAL_RX * Math.cos(tt),
      y: cy + OVAL_RY * Math.sin(tt),
    });
  }
  return pts;
};

const TRACK_POINTS = createOvalPoints(280);
const TRACK_N = TRACK_POINTS.length;

const getTrackPose = (
  progress: number,
  width: number,
  height: number,
  direction: number
) => {
  "worklet";

  let tt = progress % 1;
  if (tt < 0) tt += 1;

  const scaled = tt * TRACK_N;
  const i0 = Math.floor(scaled) % TRACK_N;
  const i1 = (i0 + 1) % TRACK_N;
  const lt = scaled - i0;

  const p0 = TRACK_POINTS[i0];
  const p1 = TRACK_POINTS[i1];

  const x = (p0.x + (p1.x - p0.x) * lt) * width;
  const y = (p0.y + (p1.y - p0.y) * lt) * height;

  let aheadT = tt + 0.008 * direction;
  if (aheadT < 0) aheadT += 1;
  aheadT %= 1;

  const aScaled = aheadT * TRACK_N;
  const j0 = Math.floor(aScaled) % TRACK_N;
  const j1 = (j0 + 1) % TRACK_N;
  const alt = aScaled - j0;

  const qa = TRACK_POINTS[j0];
  const qb = TRACK_POINTS[j1];

  const ax = (qa.x + (qb.x - qa.x) * alt) * width;
  const ay = (qa.y + (qb.y - qa.y) * alt) * height;

  const headingRad = Math.atan2(ay - y, ax - x);
  return { x, y, headingRad };
};

const clamp = (v: number, lo: number, hi: number) => {
  "worklet";
  return Math.max(lo, Math.min(hi, v));
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function OdometerScreen() {
  const settings = useSettingsUI();
  const soundEnabled =
    (settings as any).soundEnabled ?? (settings as any).soundOn ?? true;
  const openSettings =
    (settings as any).openSettings ??
    (settings as any).showSettings ??
    (settings as any).openSettingsModal ??
    (() => {});

  const [mileage, setMileage] = useState(0);

  // async sound gate
  const soundOnRef = useRef<boolean>(!!soundEnabled);
  useEffect(() => {
    soundOnRef.current = !!soundEnabled;
  }, [soundEnabled]);

  // worklet sound gate
  const soundEnabledSV = useSharedValue(soundEnabled ? 1 : 0);
  useEffect(() => {
    soundEnabledSV.value = soundEnabled ? 1 : 0;
  }, [soundEnabled, soundEnabledSV]);

  // measured center
  const tireRef = useRef<View>(null);
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);

  // motion
  const angleDeg = useSharedValue(0);
  const omegaDegPerS = useSharedValue(0);

  // track/miles
  const lapProgress = useSharedValue(0);
  const totalMiles = useSharedValue(0);
  const lastMileageInt = useSharedValue(0);

  const trackWidth = useSharedValue(0);
  const trackHeight = useSharedValue(0);

  // drag bookkeeping
  const isDragging = useSharedValue(false);
  const dragStartAngleDeg = useSharedValue(0);
  const prevDragAngleRad = useSharedValue(0);
  const cumulativeDragDeltaDeg = useSharedValue(0);

  // direction
  const carDirection = useSharedValue(1);

  // pointer state
  const pointerDown = useSharedValue(false);
  const holdElapsed = useSharedValue(0);
  const moved = useSharedValue(false);
  const downX = useSharedValue(0);
  const downY = useSharedValue(0);
  const downTimeMs = useSharedValue(0);

  // braking
  const isBraking = useSharedValue(false);
  const brakeStartSpeed = useSharedValue(0);
  const brakeElapsed = useSharedValue(0);
  const brakeDir = useSharedValue(1);

  // engine state
  const engineOn = useSharedValue(0); // 1 = should be playing
  const engineStarting = useSharedValue(0); // prevent double-start spam
  const lastImpulseMs = useSharedValue(0);

  const stopAllOdometerAudio = useCallback(() => {
    engineOn.value = 0;
    engineStarting.value = 0;
    void GlobalSoundManager.stop(ENGINE_ID);
    void GlobalSoundManager.stop(BRAKE_ID);
  }, [engineOn, engineStarting]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAllOdometerAudio();
      };
    }, [stopAllOdometerAudio])
  );

  const seedStartPosition = useCallback(() => {
    let maxY = -999;
    let idx = 0;
    TRACK_POINTS.forEach((p, i) => {
      if (p.y > maxY) {
        maxY = p.y;
        idx = i;
      }
    });
    lapProgress.value = idx / TRACK_N;
  }, [lapProgress]);

  useEffect(() => {
    seedStartPosition();
  }, [seedStartPosition]);

  useEffect(() => {
    preloadSounds({
      [ENGINE_ID]: ENGINE_SRC,
      [BRAKE_ID]: BRAKE_SRC,
    });
  }, []);

  useEffect(() => {
    if (!soundEnabled) stopAllOdometerAudio();
  }, [soundEnabled, stopAllOdometerAudio]);

  useEffect(() => {
    return () => stopAllOdometerAudio();
  }, [stopAllOdometerAudio]);

  const startEngineIfNeeded = async () => {
    if (!soundOnRef.current) return;
    try {
      await playLoopPersistent(ENGINE_ID, ENGINE_SRC, 1.0);
    } catch {}
  };

  const stopEngineNow = async () => {
    try {
      await GlobalSoundManager.stop(ENGINE_ID);
    } catch {}
  };

  const brakeScreechSequenced = async () => {
    if (!soundOnRef.current) return;
    try {
      await GlobalSoundManager.stop(ENGINE_ID);
    } catch {}
    // ✅ tiny delay = iOS “actually let go of the loop” reliability
    await delay(40);
    try {
      await playSound(BRAKE_ID, BRAKE_SRC);
    } catch {}
  };

  const bumpMileage = (milesNow: number) => {
    "worklet";
    const mi = Math.floor(milesNow);
    if (mi !== lastMileageInt.value) {
      lastMileageInt.value = mi;
      runOnJS(setMileage)(mi);
    }
  };

  const reset = useCallback(() => {
    stopAllOdometerAudio();
    setMileage(0);

    angleDeg.value = 0;
    omegaDegPerS.value = 0;

    totalMiles.value = 0;
    lastMileageInt.value = 0;

    isDragging.value = false;
    dragStartAngleDeg.value = 0;
    prevDragAngleRad.value = 0;
    cumulativeDragDeltaDeg.value = 0;

    pointerDown.value = false;
    holdElapsed.value = 0;
    moved.value = false;

    isBraking.value = false;
    brakeStartSpeed.value = 0;
    brakeElapsed.value = 0;
    brakeDir.value = 1;

    carDirection.value = 1;

    engineOn.value = 0;
    engineStarting.value = 0;

    lastImpulseMs.value = 0;

    seedStartPosition();
  }, [
    stopAllOdometerAudio,
    seedStartPosition,
    angleDeg,
    omegaDegPerS,
    totalMiles,
    lastMileageInt,
    isDragging,
    dragStartAngleDeg,
    prevDragAngleRad,
    cumulativeDragDeltaDeg,
    pointerDown,
    holdElapsed,
    moved,
    isBraking,
    brakeStartSpeed,
    brakeElapsed,
    brakeDir,
    carDirection,
    engineOn,
    engineStarting,
    lastImpulseMs,
    lapProgress,
  ]);

  const measureCenter = () => {
    setTimeout(() => {
      tireRef.current?.measureInWindow((x, y, w, h) => {
        centerX.value = x + w / 2;
        centerY.value = y + h / 2;
      });
    }, 0);
  };

  const onTireLayout = () => measureCenter();

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
    trackHeight.value = e.nativeEvent.layout.height;
  };

  useFrameCallback((frame: FrameInfo) => {
    "worklet";

    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    if (dt <= 0) return;

    const absOmega = Math.abs(omegaDegPerS.value);

    // ✅ Engine policy:
    // - Start once when spinning begins
    // - NEVER stop because of a weak flick
    // - Stop only when actually stopped OR braking OR sound off
    if (soundEnabledSV.value === 1 && !isBraking.value) {
      if (
        absOmega >= CONFIG.ENGINE_START_OMEGA &&
        engineOn.value === 0 &&
        engineStarting.value === 0
      ) {
        engineStarting.value = 1;
        engineOn.value = 1;
        runOnJS(startEngineIfNeeded)();
      }
    }

    if (soundEnabledSV.value === 0 && (engineOn.value === 1 || engineStarting.value === 1)) {
      engineOn.value = 0;
      engineStarting.value = 0;
      runOnJS(stopEngineNow)();
    }

    // hold-to-brake detection
    if (pointerDown.value && !moved.value && !isBraking.value) {
      holdElapsed.value += dt;
    } else {
      holdElapsed.value = 0;
    }

    // brake trigger
    if (
      pointerDown.value &&
      !moved.value &&
      !isBraking.value &&
      holdElapsed.value >= CONFIG.BRAKE_HOLD_SEC &&
      absOmega >= CONFIG.BRAKE_MIN_OMEGA
    ) {
      brakeDir.value = omegaDegPerS.value >= 0 ? 1 : -1;

      let baseSpeed = Math.min(absOmega / CONFIG.MAX_OMEGA_FOR_FULL_SPEED, 1);
      if (baseSpeed < CONFIG.BRAKE_MIN_SLIDE_SPEED) baseSpeed = CONFIG.BRAKE_MIN_SLIDE_SPEED;

      brakeStartSpeed.value = baseSpeed;
      brakeElapsed.value = 0;
      isBraking.value = true;

      // lock wheel immediately; car slides via timeline
      omegaDegPerS.value = 0;

      // audio: stop engine + play screech (sequenced)
      engineOn.value = 0;
      engineStarting.value = 0;
      runOnJS(brakeScreechSequenced)();
    }

    // free spin physics (no drag, no brake)
    if (!isDragging.value && !isBraking.value) {
      angleDeg.value += omegaDegPerS.value * dt;

      const factor = Math.pow(CONFIG.DAMPING_PER_SECOND, dt);
      omegaDegPerS.value *= factor;

      if (Math.abs(omegaDegPerS.value) < CONFIG.OMEGA_STOP) {
        omegaDegPerS.value = 0;

        if (engineOn.value === 1 || engineStarting.value === 1) {
          engineOn.value = 0;
          engineStarting.value = 0;
          runOnJS(stopEngineNow)();
        }
      }

      const deltaLaps = (omegaDegPerS.value * dt) / 360;
      lapProgress.value = (lapProgress.value + deltaLaps + 1) % 1;

      totalMiles.value += Math.abs(deltaLaps) * MILES_PER_LAP;
      bumpMileage(totalMiles.value);

      if (absOmega > 30) {
        carDirection.value = omegaDegPerS.value >= 0 ? 1 : -1;
      }
    }

    // braking slide timeline
    if (isBraking.value) {
      brakeElapsed.value += dt;

      const tt = Math.min(brakeElapsed.value / CONFIG.BRAKE_HARD_STOP_SEC, 1);
      const speed = brakeStartSpeed.value * (1 - tt);

      const lapsPerSec =
        CONFIG.LAPS_PER_SECOND_AT_MAX * speed * brakeDir.value;

      const deltaLaps = lapsPerSec * dt;
      lapProgress.value = (lapProgress.value + deltaLaps + 1) % 1;

      totalMiles.value += Math.abs(deltaLaps) * MILES_PER_LAP;
      bumpMileage(totalMiles.value);

      carDirection.value = brakeDir.value;

      if (tt >= 1) {
        isBraking.value = false;
      }
    }
  });

  const pan = Gesture.Pan()
    .minDistance(2)
    .hitSlop({
      top: TIRE_HIT_SLOP,
      bottom: TIRE_HIT_SLOP,
      left: TIRE_HIT_SLOP,
      right: TIRE_HIT_SLOP,
    })
    .onBegin((e: any) => {
      "worklet";

      pointerDown.value = true;
      moved.value = false;
      holdElapsed.value = 0;

      downX.value = e.absoluteX;
      downY.value = e.absoluteY;
      downTimeMs.value = Date.now();

      // ✅ Do NOT stop engine or zero omega here.
      // ✅ Do NOT arm drag yet.
      isDragging.value = false;
    })
    .onChange((e: any) => {
      "worklet";

      if (isBraking.value) return;

      const ddx = e.absoluteX - downX.value;
      const ddy = e.absoluteY - downY.value;
      const dist = Math.hypot(ddx, ddy);

      // Once movement exceeds still threshold, braking can’t trigger
      if (!moved.value && dist > CONFIG.BRAKE_STILL_PX) moved.value = true;

      // ✅ Prevent flicks from accidentally becoming drags:
      // Require BOTH time since down AND larger distance.
      if (!isDragging.value) {
        const ageMs = Date.now() - downTimeMs.value;
        if (ageMs < CONFIG.DRAG_ARM_DELAY_MS) return;
        if (dist < CONFIG.DRAG_START_PX) return;

        // Arm drag now (real drag)
        isDragging.value = true;

        // Drag takes control: stop spin (and stop engine because omega becomes 0)
        omegaDegPerS.value = 0;

        if (engineOn.value === 1 || engineStarting.value === 1) {
          engineOn.value = 0;
          engineStarting.value = 0;
          runOnJS(stopEngineNow)();
        }

        dragStartAngleDeg.value = angleDeg.value;

        const dx0 = e.absoluteX - centerX.value;
        const dy0 = e.absoluteY - centerY.value;
        prevDragAngleRad.value = Math.atan2(dy0, dx0);
        cumulativeDragDeltaDeg.value = 0;
      }

      // Drag math
      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const a = Math.atan2(dy, dx);

      let diff = a - prevDragAngleRad.value;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff <= -Math.PI) diff += 2 * Math.PI;

      let diffDeg = (diff * 180) / Math.PI;
      if (diffDeg > 20) diffDeg = 20;
      if (diffDeg < -20) diffDeg = -20;

      cumulativeDragDeltaDeg.value += diffDeg;
      prevDragAngleRad.value = a;

      angleDeg.value = dragStartAngleDeg.value + cumulativeDragDeltaDeg.value;

      const lapDelta = diffDeg * LAPS_PER_DEGREE;
      lapProgress.value = (lapProgress.value + lapDelta + 1) % 1;

      totalMiles.value += Math.abs(lapDelta) * MILES_PER_LAP;
      bumpMileage(totalMiles.value);

      if (Math.abs(diffDeg) > 0.2) {
        carDirection.value = diffDeg >= 0 ? 1 : -1;
      }
    })
    .onEnd((e: any) => {
      "worklet";

      pointerDown.value = false;
      holdElapsed.value = 0;

      if (isBraking.value) {
        isDragging.value = false;
        return;
      }

      isDragging.value = false;

      const nowMs = Date.now();
      if (nowMs - lastImpulseMs.value < 120) return;
      lastImpulseMs.value = nowMs;

      // tangential flick
      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const r = Math.max(Math.hypot(dx, dy), 1);

      const tx = -dy / r;
      const ty = dx / r;
      const tangential = e.velocityX * tx + e.velocityY * ty;
      const omegaRaw = ((tangential / r) * 180) / Math.PI;

      if (Math.abs(omegaRaw) > CONFIG.MIN_FLICK_THRESHOLD) {
        const strength = Math.min(Math.abs(omegaRaw) / 2000, 1);
        const boosted = omegaRaw * (CONFIG.BOOST_MULTIPLIER * strength);

        // BOOST (add) – and we do NOT stop engine on weak flicks
        const cur = omegaDegPerS.value;
        omegaDegPerS.value = clamp(cur + boosted, -CONFIG.MAX_OMEGA, CONFIG.MAX_OMEGA);
        carDirection.value = omegaDegPerS.value >= 0 ? 1 : -1;
      } else {
        // ✅ Weak flick: do NOTHING (no omega zero, no engine stop).
      }
    })
    .onFinalize(() => {
      "worklet";
      pointerDown.value = false;
      isDragging.value = false;
    });

  const tireStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angleDeg.value}deg` }],
  }));

  const carStyle = useAnimatedStyle(() => {
    const w = trackWidth.value;
    const h = trackHeight.value;
    if (!w || !h) return { opacity: 0 };

    const dir = carDirection.value;
    const { x, y, headingRad } = getTrackPose(lapProgress.value, w, h, dir);
    const headingDeg = (headingRad * 180) / Math.PI - 90;

    return {
      position: "absolute",
      left: x - CAR_WIDTH / 2,
      top: y - CAR_HEIGHT / 2,
      width: CAR_WIDTH,
      height: CAR_HEIGHT,
      transform: [{ rotate: `${headingDeg}deg` }],
      opacity: 1,
    };
  });

  const formattedMileage = mileage.toString().padStart(6, "0");

  return (
    <FullscreenWrapper appName={APP_IDENTITY.displayName} onReset={reset}>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <LinearGradient
            colors={[ODO_WORLD.top, ODO_WORLD.mid, ODO_WORLD.bottom]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.headerWrap} pointerEvents="box-none">
            <GameHeader
              left={<BackButton />}
              centerLabel="Miles:"
              centerValue={formattedMileage}
              onPressSettings={() => openSettings()}
            />
          </View>

          <View style={styles.stageWrap}>
            <View style={styles.stageShell}>
              <PremiumStage showShine={false} style={styles.stageSurface}>
                <View style={styles.content} pointerEvents="box-none">
                  <View
                    style={styles.trackWrapper}
                    onLayout={onTrackLayout}
                    pointerEvents="none"
                  >
                    <Image
                      source={TRACK_SRC}
                      style={styles.trackImage}
                      resizeMode="contain"
                    />

                    <Animated.View style={carStyle}>
                      <Image
                        source={CAR_SRC}
                        style={styles.carImage}
                        resizeMode="contain"
                      />
                    </Animated.View>
                  </View>

                  <View style={styles.tireWrapper}>
                    <GestureDetector gesture={pan}>
                      <Animated.View
                        ref={tireRef}
                        onLayout={onTireLayout}
                        style={[styles.tireWrap, tireStyle]}
                      >
                        <Image
                          source={TIRE_SRC}
                          style={styles.tireImage}
                          resizeMode="contain"
                        />
                      </Animated.View>
                    </GestureDetector>
                  </View>
                </View>
              </PremiumStage>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  headerWrap: {
    position: "absolute",
    top: 65,
    left: 0,
    right: 0,
    zIndex: 20,
  },

  stageWrap: {
    flex: 1,
    paddingHorizontal: t.spacing.stageMarginH,
    paddingTop: t.spacing.stageMarginTop + 72,
    paddingBottom: t.spacing.stageMarginBottom,
  },

  stageShell: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
  },

  stageSurface: {
    backgroundColor: ODO_STAGE_SURFACE,
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  trackWrapper: {
    height: TRACK_AREA_HEIGHT,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },

  trackImage: {
    width: `${100 * TRACK_SCALE}%`,
    height: `${100 * TRACK_SCALE}%`,
  },

  carImage: {
    width: CAR_WIDTH,
    height: CAR_HEIGHT,
  },

  tireWrapper: {
    height: SCREEN_H * (1 - TRACK_AREA_SCREEN_RATIO),
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: TIRE_VERTICAL_OFFSET,
  },

  tireWrap: {
    width: TIRE_SIZE,
    height: TIRE_SIZE,
    backfaceVisibility: "hidden",
  },

  tireImage: {
    width: TIRE_SIZE,
    height: TIRE_SIZE,
  },
});
