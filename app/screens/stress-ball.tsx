// Fidget Frenzy – Stress Ball v0.9-dev unified
// Expo SDK 54 / RN 0.81
// ✅ Phase I: Tap (Living)
// ✅ Phase II: Press/Hold (Pressure) + Explosion (release) + Mood Drift
// ✅ Explosion sound cycles balloon-pop-1..6 in order (non-random)
// ✅ Palette swap delayed after cool flash (intentional, not “blue glitch”)
// ✅ Crash-safe explosion gating

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

const PRESSURE_MARGIN = 0.90;
const PRESSURE_INFLATE_MIN = 1.02;
const PRESSURE_DEFORM_X_MAX = 1.14;
const PRESSURE_DEFORM_Y_MIN = 0.88;
const EXPLOSION_KICK = 1.22;

const IDLE_PULSE_ON = true;

// ---------------------------
// Mood Drift palettes (resting state)
// ---------------------------
const BALL_PALETTES: [string, string, string][] = [
  ["#16a34a", "#22c55e", "#166534"], // green
  ["#0ea5e9", "#38bdf8", "#0b3b5a"], // ocean
  ["#a78bfa", "#c4b5fd", "#3b0764"], // violet
  ["#f472b6", "#fb7185", "#701a75"], // pink glow
  ["#f59e0b", "#fbbf24", "#7c2d12"], // amber
  ["#22c55e", "#a3e635", "#14532d"], // lime
  ["#60a5fa", "#93c5fd", "#1e3a8a"], // sky
  ["#34d399", "#2dd4bf", "#064e3b"], // mint/teal
  ["#f97316", "#fb7185", "#7f1d1d"], // warm sunset
  ["#e879f9", "#c084fc", "#312e81"], // neon lavender
];

const BALL_HEAT_PALETTES: [string, string, string][] = [
  ["#4ade80", "#22c55e", "#052e16"], // green heats
  ["#22d3ee", "#38bdf8", "#082f49"], // ocean heats
  ["#e879f9", "#c084fc", "#3b0764"], // violet heats
  ["#fb7185", "#f472b6", "#500724"], // pink heats
  ["#fbbf24", "#f59e0b", "#451a03"], // amber heats
  ["#bef264", "#a3e635", "#14532d"], // lime heats
  ["#93c5fd", "#60a5fa", "#1e3a8a"], // sky heats
  ["#5eead4", "#2dd4bf", "#064e3b"], // mint heats
  ["#fb7185", "#f97316", "#7f1d1d"], // sunset heats
  ["#f0abfc", "#e879f9", "#312e81"], // lavender heats
];

// Cool flash overlay on explosion (release) — subtle
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

// Utility: shuffle array (Fisher–Yates)
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

  const bagRef = useRef<number[]>([]);
  const lastPaletteRef = useRef<number>(0);

  const popSeqRef = useRef(0);

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

  const [stageMinDim, setStageMinDim] = useState<number>(0);

  // Reanimated
  const scale = useSharedValue(1);
  const pressure = useSharedValue(0);
  const pulse = useSharedValue(1);
  const explosion = useSharedValue(0);
  const pressureStep = useSharedValue(0);
  const explosionTrigger = useSharedValue(0);

  // JS guards
  const isPressuringRef = useRef(false);
  const didExplodeRef = useRef(false);

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

    setTimeout(() => {
      didExplodeRef.current = false;
    }, 0);
  };

  const onPressureStart = async () => {
    isPressuringRef.current = true;
    didExplodeRef.current = false;
    pressureStep.value = 0;

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
    }, 60);
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

  const ballStyle = useAnimatedStyle(() => {
    const minDim = stageMinDim > 0 ? stageMinDim : BALL_SIZE * 1.9;
    const containedDim = minDim * PRESSURE_MARGIN;
    const maxContainedScale = containedDim / BALL_SIZE;

    const inflate =
      PRESSURE_INFLATE_MIN + (maxContainedScale - PRESSURE_INFLATE_MIN) * pressure.value;

    const deformX = 1 + (PRESSURE_DEFORM_X_MAX - 1) * pressure.value;
    const deformY = 1 + (PRESSURE_DEFORM_Y_MIN - 1) * pressure.value;

    const explodeKick = 1 + (EXPLOSION_KICK - 1) * explosion.value;

    return {
      transform: [
        { scale: scale.value * pulse.value * inflate * explodeKick },
        { scaleX: deformX },
        { scaleY: deformY },
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

  const gesture = Gesture.Exclusive(longPressGesture, tapGesture);

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
                    const minDim = Math.min(width, height);
                    if (minDim > 0 && Math.abs(minDim - stageMinDim) > 2) {
                      setStageMinDim(minDim);
                    }
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
