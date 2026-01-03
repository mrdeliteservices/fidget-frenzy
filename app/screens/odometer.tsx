// Fidget Frenzy – Odometer v0.9-dev (A1 Scaling)
// UI PASS (Header Standardization + World Fix)
// ✅ Replace PremiumHeader with canonical GameHeader Standard
// ✅ Replace warm cream world background with nostalgia orange/yellow gradient
// ✅ Preserve all physics/audio/gesture logic (unchanged)
// ✅ Stage cap removal uses PremiumStage showShine={false} (no overpaint hack)
// ✅ Stage surface set to solid Gears-top gray so tire doesn’t get swallowed
// NOTE: No refactors/cleanup beyond UI layer adjustments.

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
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import PremiumStage from "../../components/PremiumStage";
import GameHeader from "../../components/GameHeader";
import { frenzyTheme as t } from "../theme/frenzyTheme";
import {
  preloadSounds,
  playSound,
  playLoopPersistent,
  fadeOutAndStop,
  GlobalSoundManager,
} from "../../lib/soundManager";

// ----------------------------------------------
// USER TUNING CONTROLS
// ----------------------------------------------

// ✅ Option A: Give tire more room (track slightly shorter)
const TRACK_SCALE = 1.25;
const TRACK_AREA_SCREEN_RATIO = 0.56;

// ✅ Option A: Bigger tire + (now) moved down a bit to clear track
const TIRE_SIZE = 260;
const TIRE_VERTICAL_OFFSET = -32; // was -60 (too high). Less negative = lower.
const TIRE_RADIUS = TIRE_SIZE / 2;

// ✅ Larger touch target WITHOUT changing layout
const TIRE_HIT_SLOP = 44;

const CAR_WIDTH = 56;
const CAR_HEIGHT = 112;

const OVAL_RX = 0.246;
const OVAL_RY = 0.360;

// Brake behavior
const BRAKE_DURATION_SEC = 5.5;

// Assets
const TRACK_SRC = require("../../assets/odometer/track.png");
const CAR_SRC = require("../../assets/odometer/car_red.png");
const TIRE_SRC = require("../../assets/odometer/tire.png");

const ENGINE_ID = "race-car";
const ENGINE_SRC = require("../../assets/sounds/race-car-long.mp3");

const BRAKE_ID = "race-car-brake";
const BRAKE_SRC = require("../../assets/sounds/race-car-brake.mp3");

const { height: SCREEN_H } = Dimensions.get("window");

// Odometer “nostalgia” world palette (Matchbox/Hot Wheels vibe)
const ODO_WORLD = {
  top: "#FFE7A6",
  mid: "#FFB547",
  bottom: "#FF7A1A",
};

// ✅ Standard stage surface (sampled from Gears top tone)
const ODO_STAGE_SURFACE = "#36353A";

// ------------------------------------------------------
//  PHYSICS + AUDIO CONFIG
// ------------------------------------------------------
const CONFIG = {
  DAMPING_PER_SECOND: 0.88,
  OMEGA_STOP: 8, // deg/sec considered "stopped"

  // Flick thresholds
  FLICK_MIN_THRESHOLD: 120, // deg/sec — lower = easier flick
  MAX_OMEGA: 1500, // clamp to prevent chaos

  // Engine logic thresholds
  ENGINE_MIN_OMEGA: 550, // must exceed to start engine (rev)
  ENGINE_AUDIO_STOP_OMEGA: 220, // fade out below this while coasting
  ENGINE_FADE_OUT_MS: 500,

  // Car mapping
  MAX_OMEGA_FOR_FULL_SPEED: 1400,
  LAPS_PER_SECOND_AT_MAX: 0.9,
  MILES_PER_SECOND_AT_MAX: 3.5,
};

const LAPS_PER_DEGREE = 1 / 360;

// Prevent flick math blowups when finger ends near center
const MIN_FLICK_RADIUS_PX = 60;

// Prevent accidental snap-back reversals
const REVERSAL_MIN_CURRENT_OMEGA = 140;
const REVERSAL_ALLOW_RATIO = 0.85;
const REVERSAL_ALLOW_BONUS = 120;

// ✅ Strong direction lock when already spinning: opposite flick must be VERY intentional
const DIR_LOCK_MIN_CURRENT = 160; // deg/sec: only lock when already meaningfully spinning
const DIR_LOCK_REQUIRE_RATIO = 1.35; // opposite impulse must be >= 135% of current to reverse
const DIR_LOCK_REQUIRE_BONUS = 140; // extra “intent” boost

// ✅ Brake should work when moving (not only at high speed)
const BRAKE_MIN_OMEGA = 40; // deg/sec (very forgiving)
const BRAKE_MIN_SLIDE_SPEED = 0.25; // ensures visible slide-to-halt even at low spin

const AnimatedImage = Animated.createAnimatedComponent(Image);

// ------------------------------------------------------
// CLEAN OVAL PATH
// ------------------------------------------------------
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

const TRACK_AREA_HEIGHT = SCREEN_H * TRACK_AREA_SCREEN_RATIO;

const clamp = (v: number, lo: number, hi: number) => {
  "worklet";
  return Math.max(lo, Math.min(hi, v));
};

// ======================================================
//  COMPONENT
// ======================================================
export default function OdometerScreen() {
  const [soundOn, setSoundOn] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [mileage, setMileage] = useState(0);

  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const tireAngle = useSharedValue(0); // degrees
  const tireOmega = useSharedValue(0); // deg/sec

  const lapProgress = useSharedValue(0); // 0–1
  const totalMiles = useSharedValue(0);
  const lastMileageInt = useSharedValue(0);

  const trackWidth = useSharedValue(0);
  const trackHeight = useSharedValue(0);

  const isDragging = useSharedValue(false);
  const dragLastTouchAngle = useSharedValue(0); // radians

  // For consistent direction bias when user keeps flicking
  const lastStableDir = useSharedValue(1); // -1 / +1
  const lastDragDir = useSharedValue(0); // -1 / 0 / +1
  const dragStartAngle = useSharedValue(0); // radians

  const isBraking = useSharedValue(false);
  const carSpeed = useSharedValue(0); // 0..1
  const carDirection = useSharedValue(1); // +1 or -1
  const brakeStartSpeed = useSharedValue(0);
  const brakeElapsed = useSharedValue(0);

  // Engine audio guard
  const engineAudioOn = useSharedValue(0); // 0=off,1=on

  const stopAllOdometerAudio = useCallback(() => {
    engineAudioOn.value = 0;
    void GlobalSoundManager.stop(ENGINE_ID);
    void GlobalSoundManager.stop(BRAKE_ID);
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAllOdometerAudio();
      };
    }, [stopAllOdometerAudio])
  );

  // Start car at bottom of track
  useEffect(() => {
    let maxY = -999;
    let idx = 0;

    TRACK_POINTS.forEach((p, i) => {
      if (p.y > maxY) {
        maxY = p.y;
        idx = i;
      }
    });

    lapProgress.value = idx / TRACK_N;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    preloadSounds({
      [ENGINE_ID]: ENGINE_SRC,
      [BRAKE_ID]: BRAKE_SRC,
    });
  }, []);

  useEffect(() => {
    if (!soundOn) stopAllOdometerAudio();
  }, [soundOn, stopAllOdometerAudio]);

  useEffect(() => {
    return () => stopAllOdometerAudio();
  }, [stopAllOdometerAudio]);

  const stopEngineInstant = () => {
    engineAudioOn.value = 0;
    void GlobalSoundManager.stop(ENGINE_ID);
  };

  const stopEngineFade = () => {
    engineAudioOn.value = 0;
    void fadeOutAndStop(ENGINE_ID, CONFIG.ENGINE_FADE_OUT_MS, 12);
  };

  const playBrake = async () => {
    if (!soundOnRef.current) return;
    try {
      await playSound(BRAKE_ID, BRAKE_SRC);
    } catch {}
  };

  const startEngine = async () => {
    if (!soundOnRef.current) return;
    engineAudioOn.value = 1;
    try {
      await playLoopPersistent(ENGINE_ID, ENGINE_SRC, 1.0);
    } catch {}
  };

  const handleSpinEnd = (omega: number) => {
    const abs = Math.abs(omega);
    if (abs < CONFIG.ENGINE_MIN_OMEGA) return;
    startEngine();
  };

  const updateMileage = (v: number) => setMileage(v);

  // FRAME LOOP
  useFrameCallback((frame: FrameInfo) => {
    "worklet";

    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    if (dt <= 0) return;

    tireAngle.value += tireOmega.value * dt;
    tireOmega.value *= Math.pow(CONFIG.DAMPING_PER_SECOND, dt);

    const absOmega = Math.abs(tireOmega.value);

    // stable direction latch from actual motion
    if (absOmega > 60) {
      lastStableDir.value = tireOmega.value >= 0 ? 1 : -1;
    }

    // engine fade-out
    if (
      engineAudioOn.value === 1 &&
      !isBraking.value &&
      absOmega < CONFIG.ENGINE_AUDIO_STOP_OMEGA
    ) {
      engineAudioOn.value = 0;
      runOnJS(stopEngineFade)();
    }

    if (absOmega < CONFIG.OMEGA_STOP) {
      if (tireOmega.value !== 0) {
        tireOmega.value = 0;
        runOnJS(stopEngineInstant)();
      } else {
        tireOmega.value = 0;
      }
    }

    const spinSpeed = Math.min(absOmega / CONFIG.MAX_OMEGA_FOR_FULL_SPEED, 1);

    if (isBraking.value) {
      brakeElapsed.value += dt;
      const tt = Math.min(brakeElapsed.value / BRAKE_DURATION_SEC, 1);
      carSpeed.value = brakeStartSpeed.value * (1 - tt);

      if (tt >= 1) {
        carSpeed.value = 0;
        isBraking.value = false;
      }
    } else {
      carSpeed.value = spinSpeed;

      if (absOmega > CONFIG.OMEGA_STOP) {
        carDirection.value = tireOmega.value >= 0 ? 1 : -1;
      }
    }

    // while dragging, lapProgress updated manually in onChange
    if (isDragging.value) return;

    const lapsPerSec =
      CONFIG.LAPS_PER_SECOND_AT_MAX * carSpeed.value * carDirection.value;
    lapProgress.value = (lapProgress.value + lapsPerSec * dt + 1) % 1;

    const milesPerSec = CONFIG.MILES_PER_SECOND_AT_MAX * carSpeed.value;
    totalMiles.value += milesPerSec * dt;

    const mi = Math.floor(totalMiles.value);
    if (mi !== lastMileageInt.value) {
      lastMileageInt.value = mi;
      runOnJS(updateMileage)(mi);
    }
  });

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
    trackHeight.value = e.nativeEvent.layout.height;
  };

  // --------------------------------------------------
  // GESTURES
  // --------------------------------------------------

  // ✅ Solid flick omega from cross product (r × v) / |r|²
  const computeOmegaDegFromVelocity = (
    x: number,
    y: number,
    vx: number,
    vy: number
  ) => {
    "worklet";

    const rx = x - TIRE_RADIUS;
    const ry = y - TIRE_RADIUS;

    const r2 = rx * rx + ry * ry;
    const r = Math.max(MIN_FLICK_RADIUS_PX, Math.sqrt(r2));

    const omegaRad = (rx * vy - ry * vx) / (r * r);
    return (omegaRad * 180) / Math.PI;
  };

  const panGesture = Gesture.Pan()
    .minDistance(12)
    .hitSlop({
      top: TIRE_HIT_SLOP,
      bottom: TIRE_HIT_SLOP,
      left: TIRE_HIT_SLOP,
      right: TIRE_HIT_SLOP,
    })
    .onBegin((e) => {
      "worklet";
      if (isBraking.value) return;

      isDragging.value = true;

      const dx = e.x - TIRE_RADIUS;
      const dy = e.y - TIRE_RADIUS;
      const a = Math.atan2(dy, dx);

      dragLastTouchAngle.value = a;
      dragStartAngle.value = a;
      lastDragDir.value = 0;
    })
    .onChange((e) => {
      "worklet";
      if (isBraking.value) return;

      const dx = e.x - TIRE_RADIUS;
      const dy = e.y - TIRE_RADIUS;
      const currentAngle = Math.atan2(dy, dx);

      let delta = currentAngle - dragLastTouchAngle.value;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;

      dragLastTouchAngle.value = currentAngle;

      if (Math.abs(delta) > 0.01) {
        lastDragDir.value = delta >= 0 ? 1 : -1;
      }

      const deltaDeg = (delta * 180) / Math.PI;

      tireAngle.value += deltaDeg;

      const lapDelta = deltaDeg * LAPS_PER_DEGREE;
      lapProgress.value = (lapProgress.value + lapDelta + 1) % 1;

      if (Math.abs(delta) > 0.02) {
        carDirection.value = delta >= 0 ? 1 : -1;
      }
    })
    .onEnd((e) => {
      "worklet";
      if (isBraking.value) return;

      isDragging.value = false;

      const vx = e.velocityX || 0;
      const vy = e.velocityY || 0;

      let omegaDeg = computeOmegaDegFromVelocity(e.x, e.y, vx, vy);

      if (Math.abs(omegaDeg) < CONFIG.FLICK_MIN_THRESHOLD) return;

      if (lastDragDir.value !== 0) {
        omegaDeg = Math.abs(omegaDeg) * lastDragDir.value;
      } else {
        omegaDeg = Math.abs(omegaDeg) * lastStableDir.value;
      }

      const cur = tireOmega.value;
      const curAbs = Math.abs(cur);

      if (curAbs > DIR_LOCK_MIN_CURRENT && Math.sign(omegaDeg) !== Math.sign(cur)) {
        const required = curAbs * DIR_LOCK_REQUIRE_RATIO + DIR_LOCK_REQUIRE_BONUS;
        if (Math.abs(omegaDeg) < required) {
          omegaDeg = Math.abs(omegaDeg) * Math.sign(cur || lastStableDir.value);
        }
      }

      let nextOmega = clamp(cur + omegaDeg, -CONFIG.MAX_OMEGA, CONFIG.MAX_OMEGA);

      if (curAbs > REVERSAL_MIN_CURRENT_OMEGA && Math.sign(nextOmega) !== Math.sign(cur)) {
        const required = curAbs * REVERSAL_ALLOW_RATIO + REVERSAL_ALLOW_BONUS;

        if (Math.abs(omegaDeg) < required) {
          nextOmega = clamp(cur + omegaDeg * 0.25, -CONFIG.MAX_OMEGA, CONFIG.MAX_OMEGA);

          if (Math.sign(nextOmega) !== Math.sign(cur)) {
            nextOmega = cur * 0.85;
          }
        }
      }

      tireOmega.value = nextOmega;

      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(handleSpinEnd)(nextOmega);
    })
    .onFinalize(() => {
      "worklet";
      if (isBraking.value) return;
      isDragging.value = false;
    });

  const brakeGesture = Gesture.LongPress()
    .minDuration(250)
    .maxDistance(45)
    .hitSlop({
      top: TIRE_HIT_SLOP,
      bottom: TIRE_HIT_SLOP,
      left: TIRE_HIT_SLOP,
      right: TIRE_HIT_SLOP,
    })
    .onStart(() => {
      "worklet";
      if (isBraking.value) return;

      const absOmega = Math.abs(tireOmega.value);
      if (absOmega < BRAKE_MIN_OMEGA) return;

      isDragging.value = false;

      let baseSpeed = Math.min(absOmega / CONFIG.MAX_OMEGA_FOR_FULL_SPEED, 1);
      if (baseSpeed < BRAKE_MIN_SLIDE_SPEED) baseSpeed = BRAKE_MIN_SLIDE_SPEED;

      brakeStartSpeed.value = baseSpeed;
      carSpeed.value = baseSpeed;

      let dir = carDirection.value;
      if (tireOmega.value > 0) dir = 1;
      else if (tireOmega.value < 0) dir = -1;
      if (dir === 0) dir = lastStableDir.value;
      carDirection.value = dir;

      isBraking.value = true;
      brakeElapsed.value = 0;

      tireOmega.value = 0;

      runOnJS(stopEngineInstant)();
      runOnJS(playBrake)();
    });

  const combinedGesture = Gesture.Exclusive(brakeGesture, panGesture);

  // --------------------------------------------------
  // ANIMATED STYLES
  // --------------------------------------------------
  const tireStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tireAngle.value}deg` }],
  }));

  const carStyle = useAnimatedStyle(() => {
    const w = trackWidth.value;
    const h = trackHeight.value;
    if (!w || !h) return { opacity: 0 };

    const direction = carDirection.value;
    const { x, y, headingRad } = getTrackPose(lapProgress.value, w, h, direction);

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

  // --------------------------------------------------
  // UI RENDER
  // --------------------------------------------------
  return (
    <FullscreenWrapper>
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
              onPressSettings={() => setSettingsVisible(true)}
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
                    <AnimatedImage
                      source={CAR_SRC}
                      style={carStyle}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={styles.tireWrapper}>
                    <GestureDetector gesture={combinedGesture}>
                      <Animated.View
                        style={[styles.tireRasterWrap, tireStyle]}
                        shouldRasterizeIOS
                        renderToHardwareTextureAndroid
                        needsOffscreenAlphaCompositing
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

                <SettingsModal
                  visible={settingsVisible}
                  onClose={() => setSettingsVisible(false)}
                  onReset={() => {
                    tireAngle.value = 0;
                    tireOmega.value = 0;
                    lapProgress.value = 0;
                    totalMiles.value = 0;
                    lastMileageInt.value = 0;

                    isBraking.value = false;
                    carSpeed.value = 0;
                    carDirection.value = 1;
                    brakeStartSpeed.value = 0;
                    brakeElapsed.value = 0;

                    isDragging.value = false;
                    dragLastTouchAngle.value = 0;
                    dragStartAngle.value = 0;
                    lastDragDir.value = 0;
                    lastStableDir.value = 1;

                    setMileage(0);
                    stopEngineInstant();
                  }}
                  soundOn={soundOn}
                  setSoundOn={setSoundOn}
                />
              </PremiumStage>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </FullscreenWrapper>
  );
}

// --------------------------------------------------
// STYLES (UI only)
// --------------------------------------------------
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

  tireWrapper: {
    height: SCREEN_H * (1 - TRACK_AREA_SCREEN_RATIO),
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: TIRE_VERTICAL_OFFSET,
  },

  tireRasterWrap: {
    width: TIRE_SIZE,
    height: TIRE_SIZE,
    backfaceVisibility: "hidden",
  },

  tireImage: {
    width: TIRE_SIZE,
    height: TIRE_SIZE,
  },
});
