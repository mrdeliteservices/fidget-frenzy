// Fidget Frenzy – Odometer v0.9-dev (A1 Scaling)
// Engine sound: persistent loop + fade-out on slow-down (Option B)

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
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
import { Ionicons } from "@expo/vector-icons";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import {
  preloadSounds,
  playSound,
  playLoopPersistent,
  GlobalSoundManager,
} from "../../lib/soundManager";

// ----------------------------------------------
// USER TUNING CONTROLS
// ----------------------------------------------

const TRACK_SCALE = 1.25;
const TRACK_AREA_SCREEN_RATIO = 0.60;

const TIRE_SIZE = 220;
const TIRE_VERTICAL_OFFSET = -20;
const TIRE_RADIUS = TIRE_SIZE / 2;

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

const BRAND = { blue: "#081A34", gold: "#FDD017", silver: "#C0C0C0" };

// ------------------------------------------------------
//  PHYSICS CONFIG
// ------------------------------------------------------
const CONFIG = {
  DAMPING_PER_SECOND: 0.88,
  OMEGA_STOP: 8,

  FLICK_MIN_THRESHOLD: 40, // deg/sec
  FLICK_X_OMEGA_MULTIPLIER: 0.25, // vx -> omega

  ENGINE_MIN_OMEGA: 550,

  MAX_OMEGA_FOR_FULL_SPEED: 1400,
  LAPS_PER_SECOND_AT_MAX: 0.9,
  MILES_PER_SECOND_AT_MAX: 3.5,
};

const LAPS_PER_DEGREE = 1 / 360;

// Stop engine audio BEFORE full stop, but fade out so it feels natural
const ENGINE_AUDIO_STOP_OMEGA = 220; // deg/sec (tune 180–300)
const ENGINE_FADE_OUT_MS = 500;      // tune 350–650

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
    const t = (i / count) * Math.PI * 2;
    pts.push({
      x: cx + OVAL_RX * Math.cos(t),
      y: cy + OVAL_RY * Math.sin(t),
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

  let t = progress % 1;
  if (t < 0) t += 1;

  const scaled = t * TRACK_N;
  const i0 = Math.floor(scaled) % TRACK_N;
  const i1 = (i0 + 1) % TRACK_N;
  const lt = scaled - i0;

  const p0 = TRACK_POINTS[i0];
  const p1 = TRACK_POINTS[i1];

  const x = (p0.x + (p1.x - p0.x) * lt) * width;
  const y = (p0.y + (p1.y - p0.y) * lt) * height;

  let aheadT = t + 0.008 * direction;
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
  const speedFactor = useSharedValue(0); // 0–1
  const totalMiles = useSharedValue(0);
  const lastMileageInt = useSharedValue(0);

  const trackWidth = useSharedValue(0);
  const trackHeight = useSharedValue(0);

  const isDragging = useSharedValue(false);
  const dragLastTouchAngle = useSharedValue(0); // radians

  const isBraking = useSharedValue(false);
  const carSpeed = useSharedValue(0); // 0..1
  const carDirection = useSharedValue(1); // +1 or -1
  const brakeStartSpeed = useSharedValue(0);
  const brakeElapsed = useSharedValue(0);

  // Avoid repeated stop/fade calls
  const engineAudioOn = useSharedValue(0); // 0 = off, 1 = on

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
  }, []);

  useEffect(() => {
    preloadSounds({
      [ENGINE_ID]: ENGINE_SRC,
      [BRAKE_ID]: BRAKE_SRC,
    });
  }, []);

  // If sound gets turned OFF, kill all active odometer sounds immediately (no fade)
  useEffect(() => {
    if (!soundOn) {
      try {
        engineAudioOn.value = 0;
        GlobalSoundManager.stop(ENGINE_ID);
        GlobalSoundManager.stop(BRAKE_ID);
      } catch {}
    }
  }, [soundOn]);

  useEffect(() => {
    return () => {
      try {
        engineAudioOn.value = 0;
        GlobalSoundManager.stop(ENGINE_ID);
        GlobalSoundManager.stop(BRAKE_ID);
      } catch {}
    };
  }, []);

  const stopEngineInstant = () => {
    engineAudioOn.value = 0;
    GlobalSoundManager.stop(ENGINE_ID);
  };

  // Fade-out stop for natural slow-down feel (Option B)
  const stopEngineFade = () => {
    engineAudioOn.value = 0;
    // uses the new SoundManager.fadeOutAndStop()
    // @ts-ignore - method exists after you add it to soundManager.ts
    GlobalSoundManager.fadeOutAndStop(ENGINE_ID, ENGINE_FADE_OUT_MS, 12);
  };

  const playBrake = async () => {
    if (!soundOnRef.current) return;
    try {
      await playSound(BRAKE_ID, BRAKE_SRC);
    } catch {}
  };

  const startEngineForDirection = async (direction: number) => {
    if (!soundOnRef.current) return;

    // direction kept for future use
    const _dir = direction >= 0 ? 1 : -1;

    engineAudioOn.value = 1;

    try {
      await playLoopPersistent(ENGINE_ID, ENGINE_SRC, 1.0);
    } catch {
      // silent
    }
  };

  const handleSpinEnd = (omega: number) => {
    const abs = Math.abs(omega);
    if (abs < CONFIG.ENGINE_MIN_OMEGA) return;

    const dir = omega >= 0 ? 1 : -1;
    startEngineForDirection(dir);
  };

  const updateMileage = (v: number) => setMileage(v);

  // FRAME LOOP
  useFrameCallback((frame: FrameInfo) => {
    "worklet";

    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    if (dt <= 0) return;

    // Tire spin integration
    tireAngle.value += tireOmega.value * dt;

    const damping = CONFIG.DAMPING_PER_SECOND;
    tireOmega.value *= Math.pow(damping, dt);

    const absOmega = Math.abs(tireOmega.value);

    // Fade out engine audio earlier so it doesn't roar during slow creep.
    // Only do this when not braking and not actively dragging.
    if (
      engineAudioOn.value === 1 &&
      !isBraking.value &&
      !isDragging.value &&
      absOmega < ENGINE_AUDIO_STOP_OMEGA
    ) {
      engineAudioOn.value = 0;
      runOnJS(stopEngineFade)();
    }

    // Full stop (hard stop is fine here; audio should already be off from fade)
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
      const t = Math.min(brakeElapsed.value / BRAKE_DURATION_SEC, 1);
      carSpeed.value = brakeStartSpeed.value * (1 - t);

      if (t >= 1) {
        carSpeed.value = 0;
        isBraking.value = false;
      }
    } else {
      carSpeed.value = spinSpeed;

      if (absOmega > CONFIG.OMEGA_STOP) {
        carDirection.value = tireOmega.value >= 0 ? 1 : -1;
      }
    }

    speedFactor.value = carSpeed.value;

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
  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      if (isBraking.value) return;

      isDragging.value = true;

      const dx = e.x - TIRE_RADIUS;
      const dy = e.y - TIRE_RADIUS;
      const angle = Math.atan2(dy, dx);

      dragLastTouchAngle.value = angle;

      // Take manual control of the tire
      tireOmega.value = 0;
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

      const deltaDeg = (delta * 180) / Math.PI;

      tireAngle.value += deltaDeg;

      const lapDelta = deltaDeg * LAPS_PER_DEGREE;
      lapProgress.value = (lapProgress.value + lapDelta + 1) % 1;

      if (Math.abs(delta) > 0.0005) {
        carDirection.value = delta >= 0 ? 1 : -1;
      }
    })
    .onEnd((e) => {
      "worklet";
      if (isBraking.value) return;

      isDragging.value = false;

      const vx = e.velocityX || 0;
      const omegaDeg = vx * CONFIG.FLICK_X_OMEGA_MULTIPLIER;
      const abs = Math.abs(omegaDeg);

      if (abs > CONFIG.FLICK_MIN_THRESHOLD) {
        tireOmega.value = omegaDeg;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(handleSpinEnd)(omegaDeg);
      }
    })
    .onFinalize(() => {
      "worklet";
      if (isBraking.value) return;
      isDragging.value = false;
    });

  const brakeGesture = Gesture.LongPress()
    .minDuration(250)
    .maxDistance(20)
    .onStart(() => {
      "worklet";

      if (isBraking.value) return;

      const absOmega = Math.abs(tireOmega.value);
      let baseSpeed = Math.min(absOmega / CONFIG.MAX_OMEGA_FOR_FULL_SPEED, 1);

      const MIN_SLIDE_SPEED = 0.35;
      if (baseSpeed < MIN_SLIDE_SPEED) {
        baseSpeed = MIN_SLIDE_SPEED;
      }

      brakeStartSpeed.value = baseSpeed;
      carSpeed.value = baseSpeed;

      let dir = carDirection.value;
      if (tireOmega.value > 0) dir = 1;
      else if (tireOmega.value < 0) dir = -1;
      if (dir === 0) dir = 1;
      carDirection.value = dir;

      isBraking.value = true;
      brakeElapsed.value = 0;

      tireOmega.value = 0;

      // Brake should hard-cut engine immediately (no fade)
      runOnJS(stopEngineInstant)();
      runOnJS(playBrake)();
    })
    .onEnd(() => {
      "worklet";
    });

  const combinedGesture = Gesture.Simultaneous(panGesture, brakeGesture);

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

    const { x, y, headingRad } = getTrackPose(
      lapProgress.value,
      w,
      h,
      direction
    );

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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <BackButton />
            <View style={styles.mileageBlock}>
              <Text style={styles.mileageText}>{formattedMileage}</Text>
              <Text style={styles.mileageLabel}>ODOMETER</Text>
            </View>
            <Ionicons
              name="settings-sharp"
              size={26}
              color={BRAND.silver}
              onPress={() => setSettingsVisible(true)}
            />
          </View>

          <View style={styles.topDivider} />

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
                style={[styles.carBase, carStyle]}
                resizeMode="contain"
              />
            </View>

            <View style={styles.tireWrapper}>
              <GestureDetector gesture={combinedGesture}>
                <AnimatedImage
                  source={TIRE_SRC}
                  style={[styles.tireImage, tireStyle]}
                  resizeMode="contain"
                />
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
              speedFactor.value = 0;

              isBraking.value = false;
              carSpeed.value = 0;
              carDirection.value = 1;
              brakeStartSpeed.value = 0;
              brakeElapsed.value = 0;

              setMileage(0);
              stopEngineInstant();
            }}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
          />
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  headerRow: {
    marginTop: 4,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topDivider: {
    height: 2,
    width: "100%",
    backgroundColor: BRAND.blue,
    marginTop: 6,
  },

  mileageBlock: { alignItems: "center" },
  mileageText: {
    color: BRAND.gold,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
  },
  mileageLabel: { color: "rgba(0,0,0,0.5)", fontSize: 14, marginTop: 4 },

  content: { flex: 1, alignItems: "center", justifyContent: "flex-start" },

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

  carBase: { position: "absolute" },

  tireWrapper: {
    height: SCREEN_H * (1 - TRACK_AREA_SCREEN_RATIO),
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: TIRE_VERTICAL_OFFSET,
  },

  tireImage: { width: TIRE_SIZE, height: TIRE_SIZE },
});
