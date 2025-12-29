// Fidget Frenzy – Stress Ball v0.9-dev unified
// Expo SDK 54 / RN 0.81
// ✅ Phase I: Tap (Living)
// ✅ Phase II: Press/Hold (Pressure) + Explosion (release) + Mood Drift
// ✅ Explosion sound cycles balloon-pop-1..6 in order (non-random)
// ✅ Palette swap delayed after cool flash (intentional, not “blue glitch”)
// ✅ Crash-safe explosion gating
// ✅ Phase III: Drag (Explore)
//    - Axis-correct bounds (width & height)
//    - HARD clamp translation (ball never goes out of frame)
//    - Wall resistance via deformation (tension) when pushing into edge
//    - SAFE_EDGE_PAD removes tiny pixel clipping caused by pulse/stretch/overshoot
//    - Spring return on release
//
// IMPORTANT:
// - No JS helpers inside useAnimatedStyle; all math is worklet-safe.

import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, SafeAreaView } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import PremiumStage from "../../components/PremiumStage";
import GameHeader from "../../components/GameHeader";
import { frenzyTheme as t } from "../theme/frenzyTheme";
import { playSound, preloadSounds } from "../../lib/soundManager";

const { width: W } = Dimensions.get("window");
const BALL_SIZE = W * 0.52;
const HEADER_TOP = 65;

const STRESS_WORLD = {
  top: "#7CF7E6",
  mid: "#2DD4BF",
  bottom: "#0B5C59",
};

const STRESS_STAGE_SURFACE = "#36353A";

// ---------------------------
// Physics tuning knobs
// ---------------------------
const TAP_SQUISH = 0.86;
const HOLD_RAMP_MS = 1400;
const LONG_PRESS_MIN_MS = 220;

// Pressure containment margin (inflate must stay within this)
const PRESSURE_MARGIN = 0.90;
const PRESSURE_INFLATE_MIN = 1.02;
const PRESSURE_DEFORM_X_MAX = 1.14;
const PRESSURE_DEFORM_Y_MIN = 0.88;
const EXPLOSION_KICK = 1.22;

const IDLE_PULSE_ON = true;

// ---------------------------
// Drag tuning (Explore)
// ---------------------------
const DRAG_MIN_DISTANCE = 10;

// ✅ Real-drag threshold for counting a "squeeze" on drag release
// If translation distance exceeds this at any point during the drag, release increments Squeezes by +1
const DRAG_SQUEEZE_THRESHOLD = 8; // px (tune 6–12)

// Drag containment margin (closer to edges than pressure)
// 0.98 means we allow movement within 98% of the stage dimension
const DRAG_MARGIN = 0.98;

// Safety pad to prevent tiny pixel clipping (pulse/stretch/spring overshoot)
const SAFE_EDGE_PAD = 2; // px (tune 6–12)

const DRAG_MAX_STRETCH = 0.14;
const DRAG_MAX_SQUASH = 0.09;
const DRAG_SPRING = { stiffness: 260, damping: 20 };

// Wall tension additions (when pushing into the edge)
const WALL_TENSION_STRETCH_ADD = 0.04;
const WALL_TENSION_SQUASH_ADD = 0.03;

// ---------------------------
// Mood Drift palettes (resting state)
// ---------------------------
const BALL_PALETTES: [string, string, string][] = [
  ["#16a34a", "#22c55e", "#166534"],
  ["#0ea5e9", "#38bdf8", "#0b3b5a"],
  ["#a78bfa", "#c4b5fd", "#3b0764"],
  ["#f472b6", "#fb7185", "#701a75"],
  ["#f59e0b", "#fbbf24", "#7c2d12"],
  ["#22c55e", "#a3e635", "#14532d"],
  ["#60a5fa", "#93c5fd", "#1e3a8a"],
  ["#34d399", "#2dd4bf", "#064e3b"],
  ["#f97316", "#fb7185", "#7f1d1d"],
  ["#e879f9", "#c084fc", "#312e81"],
];

const BALL_HEAT_PALETTES: [string, string, string][] = [
  ["#4ade80", "#22c55e", "#052e16"],
  ["#22d3ee", "#38bdf8", "#082f49"],
  ["#e879f9", "#c084fc", "#3b0764"],
  ["#fb7185", "#f472b6", "#500724"],
  ["#fbbf24", "#f59e0b", "#451a03"],
  ["#bef264", "#a3e635", "#14532d"],
  ["#93c5fd", "#60a5fa", "#1e3a8a"],
  ["#5eead4", "#2dd4bf", "#064e3b"],
  ["#fb7185", "#f97316", "#7f1d1d"],
  ["#f0abfc", "#e879f9", "#312e81"],
];

const COOL_OVERLAY: [string, string, string] = ["#22d3ee", "#38bdf8", "#0ea5e9"];

// Balloon pop sequence (explosion only): 1 → 6 → 1 → ...
const BALLOON_POP_FILES = [
  require("../../assets/sounds/balloon-pop-1.mp3"),
  require("../../assets/sounds/balloon-pop-2.mp3"),
  require("../../assets/sounds/balloon-pop-3.mp3"),
  require("../../assets/sounds/balloon-pop-4.mp3"),
  require("../../assets/sounds/balloon-pop-5.mp3"),
  require("../../assets/sounds/balloon-pop-6.mp3"),
] as const;

const BALLOON_POP_KEYS = [
  "balloon-pop-1",
  "balloon-pop-2",
  "balloon-pop-3",
  "balloon-pop-4",
  "balloon-pop-5",
  "balloon-pop-6",
] as const;

// Utility: shuffle array (Fisher–Yates) — JS only
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function StressBallScreen() {
  const [soundOn, setSoundOn] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [pressCount, setPressCount] = useState(0);

  const [paletteIndex, setPaletteIndex] = useState(0);

  // ✅ helper for UI-thread -> JS increments
  const incPressCount = () => setPressCount((p) => p + 1);

  // Shuffle bag for palette drift
  const bagRef = useRef<number[]>([]);
  const lastPaletteRef = useRef<number>(0);

  // Explosion pop sequence index
  const popSeqRef = useRef(0);

  // Delay timer for palette swap after explosion flash
  const paletteSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextPaletteIndex = () => {
    if (bagRef.current.length === 0) {
      const all = Array.from({ length: BALL_PALETTES.length }, (_, i) => i);
      const filtered = all.filter((i) => i !== lastPaletteRef.current);
      bagRef.current = shuffle(filtered.length > 0 ? filtered : all);
    }
    const next = bagRef.current.shift();
    const idx = typeof next === "number" ? next : 0;
    lastPaletteRef.current = idx;
    return idx;
  };

  // Stage size for containment (AXIS-SPECIFIC)
  const [stageW, setStageW] = useState<number>(0);
  const [stageH, setStageH] = useState<number>(0);

  // Reanimated
  const scale = useSharedValue(1);
  const pressure = useSharedValue(0);
  const pulse = useSharedValue(1);
  const explosion = useSharedValue(0);
  const pressureStep = useSharedValue(0);
  const explosionTrigger = useSharedValue(0);

  // Drag (Explore)
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  // ✅ Track whether the current drag should count as a squeeze
  const dragCountsSV = useSharedValue(false);

  // Shared pressuring flag (UI thread)
  const isPressuringSV = useSharedValue(0);

  // JS guards
  const isPressuringRef = useRef(false);
  const didExplodeRef = useRef(false);
  const didDragHapticRef = useRef(false);

  useEffect(() => {
    preloadSounds({
      squish: require("../../assets/sounds/squish.mp3"),
      pop: require("../../assets/sounds/pop.mp3"),
      bubble: require("../../assets/sounds/bubble.mp3"),

      "balloon-pop-1": BALLOON_POP_FILES[0],
      "balloon-pop-2": BALLOON_POP_FILES[1],
      "balloon-pop-3": BALLOON_POP_FILES[2],
      "balloon-pop-4": BALLOON_POP_FILES[3],
      "balloon-pop-5": BALLOON_POP_FILES[4],
      "balloon-pop-6": BALLOON_POP_FILES[5],
    });

    // seed bag
    lastPaletteRef.current = 0;
    bagRef.current = shuffle(
      Array.from({ length: BALL_PALETTES.length }, (_, i) => i).filter((i) => i !== 0)
    );

    if (IDLE_PULSE_ON) {
      pulse.value = withRepeat(
        withSequence(
          withSpring(1.02, { stiffness: 55, damping: 12 }),
          withSpring(0.98, { stiffness: 55, damping: 12 })
        ),
        -1,
        true
      );
    }

    return () => {
      if (paletteSwapTimerRef.current) {
        clearTimeout(paletteSwapTimerRef.current);
        paletteSwapTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bumpBackToRest = () => {
    scale.value = withSpring(1.08, { stiffness: 160, damping: 12 }, () => {
      scale.value = withSpring(1, { stiffness: 140, damping: 14 });
    });
  };

  const resetDrag = () => {
    dragX.value = withSpring(0, DRAG_SPRING);
    dragY.value = withSpring(0, DRAG_SPRING);
  };

  const onTap = async () => {
    if (isPressuringRef.current) return;

    scale.value = withSpring(TAP_SQUISH, { stiffness: 170, damping: 12 });

    if (soundOn) await playSound("squish", require("../../assets/sounds/squish.mp3"));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPressCount((p) => p + 1);

    if (soundOn) await playSound("pop", require("../../assets/sounds/pop.mp3"));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    bumpBackToRest();
  };

  const stepFX = async (step: number) => {
    if (!isPressuringRef.current) return;
    if (didExplodeRef.current) return;

    try {
      if (step === 1) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (soundOn) await playSound("squish", require("../../assets/sounds/squish.mp3"));
      } else if (step === 2) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (soundOn) await playSound("bubble", require("../../assets/sounds/bubble.mp3"));
      } else if (step === 3) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (soundOn) await playSound("squish", require("../../assets/sounds/squish.mp3"));
      } else if (step === 4) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch {}
  };

  const runExplosionFX = async () => {
    if (didExplodeRef.current) return;

    didExplodeRef.current = true;
    setPressCount((p) => p + 1);

    try {
      if (soundOn) {
        const idx = popSeqRef.current % BALLOON_POP_FILES.length;
        await playSound(BALLOON_POP_KEYS[idx], BALLOON_POP_FILES[idx]);
        popSeqRef.current = (idx + 1) % BALLOON_POP_FILES.length;
      }
    } catch {}

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    if (paletteSwapTimerRef.current) clearTimeout(paletteSwapTimerRef.current);
    paletteSwapTimerRef.current = setTimeout(() => {
      setPaletteIndex(nextPaletteIndex());
      paletteSwapTimerRef.current = null;
    }, 280);

    isPressuringRef.current = false;
    isPressuringSV.value = 0;

    resetDrag();

    setTimeout(() => {
      didExplodeRef.current = false;
    }, 0);
  };

  const onPressureStart = async () => {
    isPressuringRef.current = true;
    isPressuringSV.value = 1;
    didExplodeRef.current = false;
    pressureStep.value = 0;

    resetDrag();

    scale.value = withSpring(0.99, { stiffness: 140, damping: 16 });
    pressure.value = 0;
    explosion.value = 0;

    if (soundOn) await playSound("bubble", require("../../assets/sounds/bubble.mp3"));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    pressure.value = withTiming(
      1,
      { duration: HOLD_RAMP_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (!finished) return;

        explosion.value = withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(0, { duration: 240 })
        );

        explosionTrigger.value = explosionTrigger.value + 1;

        pressure.value = withTiming(0, { duration: 220 });
        scale.value = withSpring(1, { stiffness: 170, damping: 14 });

        pressureStep.value = 0;
      }
    );
  };

  const onPressureRelease = async () => {
    if (didExplodeRef.current) {
      isPressuringRef.current = false;
      isPressuringSV.value = 0;
      return;
    }

    setPressCount((p) => p + 1);

    cancelAnimation(pressure);
    pressure.value = withTiming(0, { duration: 140 });
    pressureStep.value = 0;

    if (soundOn) await playSound("pop", require("../../assets/sounds/pop.mp3"));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    bumpBackToRest();

    setTimeout(() => {
      isPressuringRef.current = false;
      isPressuringSV.value = 0;
    }, 60);
  };

  const onDragBeginJS = async () => {
    if (isPressuringRef.current) return;
    if (didDragHapticRef.current) return;
    didDragHapticRef.current = true;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const onDragFinalizeJS = () => {
    didDragHapticRef.current = false;
  };

  const reset = () => setPressCount(0);

  useAnimatedReaction(
    () => {
      const p = pressure.value;
      if (p < 0.25) return 0;
      if (p < 0.55) return 1;
      if (p < 0.8) return 2;
      if (p < 0.93) return 3;
      return 4;
    },
    (nextStep) => {
      if (nextStep === pressureStep.value) return;
      pressureStep.value = nextStep;
      if (nextStep > 0) runOnJS(stepFX)(nextStep);
    }
  );

  useAnimatedReaction(
    () => explosionTrigger.value,
    (v, prev) => {
      if (prev == null) return;
      if (v !== prev) runOnJS(runExplosionFX)();
    }
  );

  // ---------------------------
  // Animated styles (WORKLET-SAFE)
  // ---------------------------
  const ballStyle = useAnimatedStyle(() => {
    const w = stageW > 0 ? stageW : BALL_SIZE * 1.9;
    const h = stageH > 0 ? stageH : BALL_SIZE * 2.4;

    // pressure containment (stricter)
    const containedWPressure = w * PRESSURE_MARGIN;
    const containedHPressure = h * PRESSURE_MARGIN;

    // drag containment (looser)
    const containedWDrag = w * DRAG_MARGIN;
    const containedHDrag = h * DRAG_MARGIN;

    // worst-case visual stretch (drag stretch + wall tension)
    const MAX_DRAG_STRETCH = 1 + DRAG_MAX_STRETCH + WALL_TENSION_STRETCH_ADD;
    const SAFE_BALL = BALL_SIZE * MAX_DRAG_STRETCH;

    // axis-specific translation bounds (subtract pad to eliminate tiny clipping)
    const maxTx = Math.max(0, (containedWDrag - SAFE_BALL) / 2 - SAFE_EDGE_PAD);
    const maxTy = Math.max(0, (containedHDrag - SAFE_BALL) / 2 - SAFE_EDGE_PAD);

    const rawX = dragX.value;
    const rawY = dragY.value;

    // HARD clamp translation (axis-specific)
    const tx = Math.max(-maxTx, Math.min(maxTx, rawX));
    const ty = Math.max(-maxTy, Math.min(maxTy, rawY));

    // Overdrag — how hard user is pushing into edge
    const overX = Math.max(0, Math.abs(rawX) - maxTx);
    const overY = Math.max(0, Math.abs(rawY) - maxTy);
    const over = overX + overY;

    // Normalize wall tension 0..1
    const base = Math.max(1, (maxTx + maxTy) * 0.5);
    const tension = Math.min(1, over / (base * 0.75));

    // Pressure inflate must remain contained in BOTH axes
    const maxScaleX = containedWPressure / BALL_SIZE;
    const maxScaleY = containedHPressure / BALL_SIZE;
    const maxContainedScale = Math.max(1, Math.min(maxScaleX, maxScaleY));

    const inflate =
      PRESSURE_INFLATE_MIN + (maxContainedScale - PRESSURE_INFLATE_MIN) * pressure.value;

    const deformXPressure = 1 + (PRESSURE_DEFORM_X_MAX - 1) * pressure.value;
    const deformYPressure = 1 + (PRESSURE_DEFORM_Y_MIN - 1) * pressure.value;

    const pressuring = isPressuringSV.value > 0.5;

    // Normalize distance 0..1 against axis bounds
    const nx = maxTx > 0 ? Math.min(1, Math.abs(tx) / maxTx) : 0;
    const ny = maxTy > 0 ? Math.min(1, Math.abs(ty) / maxTy) : 0;
    const d = Math.min(1, Math.max(nx, ny));

    // Tug deformation + wall tension
    const stretchAmt = DRAG_MAX_STRETCH + WALL_TENSION_STRETCH_ADD * tension;
    const squashAmt = DRAG_MAX_SQUASH + WALL_TENSION_SQUASH_ADD * tension;

    const dragStretch = 1 + stretchAmt * d;
    const dragSquash = 1 - squashAmt * d;

    // Tug orientation
    const ax = Math.abs(tx);
    const ay = Math.abs(ty);
    const denom = ax + ay + 0.0001;
    const biasX = ax / denom;
    const biasY = 1 - biasX;

    const dragScaleX = 1 + (dragStretch - 1) * biasX + (dragSquash - 1) * biasY;
    const dragScaleY = 1 + (dragStretch - 1) * biasY + (dragSquash - 1) * biasX;

    const explodeKick = 1 + (EXPLOSION_KICK - 1) * explosion.value;

    return {
      transform: [
        { translateX: pressuring ? 0 : tx },
        { translateY: pressuring ? 0 : ty },
        { scale: scale.value * pulse.value * inflate * explodeKick },
        { scaleX: deformXPressure * (pressuring ? 1 : dragScaleX) },
        { scaleY: deformYPressure * (pressuring ? 1 : dragScaleY) },
      ],
    };
  });

  const heatStyle = useAnimatedStyle(() => {
    const p = pressure.value;
    const o = Math.min(1, Math.max(0, (p - 0.12) / 0.88) * 0.92);
    return { opacity: o };
  });

  const coolStyle = useAnimatedStyle(() => {
    const o = Math.min(1, explosion.value * 0.55);
    return { opacity: o };
  });

  // ---------------------------
  // Gestures
  // ---------------------------
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_, success) => {
      if (!success) return;
      runOnJS(onTap)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(LONG_PRESS_MIN_MS)
    .maxDistance(20)
    .onStart(() => runOnJS(onPressureStart)())
    .onEnd(() => runOnJS(onPressureRelease)());

  const panGesture = Gesture.Pan()
    .minDistance(DRAG_MIN_DISTANCE)
    .onBegin(() => {
      if (isPressuringSV.value > 0.5) return;

      // ✅ reset per-gesture drag count flag
      dragCountsSV.value = false;

      runOnJS(onDragBeginJS)();
    })
    .onUpdate((e) => {
      if (isPressuringSV.value > 0.5) return;

      dragX.value = e.translationX;
      dragY.value = e.translationY;

      // ✅ mark as a "real drag" once threshold exceeded
      const dist = Math.hypot(e.translationX, e.translationY);
      if (!dragCountsSV.value && dist > DRAG_SQUEEZE_THRESHOLD) {
        dragCountsSV.value = true;
      }
    })
    .onEnd(() => {
      if (isPressuringSV.value > 0.5) return;

      dragX.value = withSpring(0, DRAG_SPRING);
      dragY.value = withSpring(0, DRAG_SPRING);

      // ✅ increment squeezes on release for real drags
      if (dragCountsSV.value) {
        runOnJS(incPressCount)();
      }
    })
    .onFinalize(() => {
      if (isPressuringSV.value > 0.5) return;

      dragX.value = withSpring(0, DRAG_SPRING);
      dragY.value = withSpring(0, DRAG_SPRING);

      // ✅ always clear flag + existing finalize hook
      dragCountsSV.value = false;
      runOnJS(onDragFinalizeJS)();
    });

  const pressGesture = Gesture.Exclusive(longPressGesture, tapGesture);
  const gesture = Gesture.Simultaneous(panGesture, pressGesture);

  const [c1, c2, c3] = BALL_PALETTES[paletteIndex] ?? BALL_PALETTES[0];
  const [h1, h2, h3] = BALL_HEAT_PALETTES[paletteIndex] ?? BALL_HEAT_PALETTES[0];

  return (
    <FullscreenWrapper>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <LinearGradient
            colors={[STRESS_WORLD.top, STRESS_WORLD.mid, STRESS_WORLD.bottom]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.headerWrap} pointerEvents="box-none">
            <GameHeader
              left={<BackButton />}
              centerLabel="Squeezes:"
              centerValue={pressCount}
              onPressSettings={() => setSettingsVisible(true)}
            />
          </View>

          <View style={styles.stageWrap}>
            <View style={styles.stageShell}>
              <PremiumStage showShine={false} style={{ backgroundColor: STRESS_STAGE_SURFACE }}>
                <View
                  style={styles.content}
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    if (width > 0 && Math.abs(width - stageW) > 2) setStageW(width);
                    if (height > 0 && Math.abs(height - stageH) > 2) setStageH(height);
                  }}
                >
                  <GestureDetector gesture={gesture}>
                    <Animated.View style={[styles.ball, ballStyle]}>
                      <Animated.View style={StyleSheet.absoluteFill}>
                        <LinearGradient
                          colors={[c1, c2, c3]}
                          start={{ x: 0.15, y: 0 }}
                          end={{ x: 0.9, y: 1 }}
                          style={styles.ballGradient}
                        />
                      </Animated.View>

                      <Animated.View style={[StyleSheet.absoluteFill, heatStyle]}>
                        <LinearGradient
                          colors={[h1, h2, h3]}
                          start={{ x: 0.2, y: 0 }}
                          end={{ x: 0.9, y: 1 }}
                          style={styles.ballGradient}
                        />
                      </Animated.View>

                      <Animated.View style={[StyleSheet.absoluteFill, coolStyle]}>
                        <LinearGradient
                          colors={COOL_OVERLAY}
                          start={{ x: 0.2, y: 0 }}
                          end={{ x: 0.9, y: 1 }}
                          style={styles.ballGradient}
                        />
                      </Animated.View>
                    </Animated.View>
                  </GestureDetector>
                </View>
              </PremiumStage>
            </View>
          </View>

          <SettingsModal
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            onReset={reset}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
          />
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
    top: HEADER_TOP,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
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

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },

  ballGradient: {
    flex: 1,
    borderRadius: BALL_SIZE / 2,
  },
});
