// app/screens/stress-ball.tsx
// Fidget Frenzy – Stress Ball v0.9-dev unified
// Expo SDK 54 / RN 0.81
// ✅ Shell-standard Settings sound toggle (no local SettingsModal)
// ✅ Reliable pooled SFX playback (Expo Go rapid triggers safe)
// ✅ soundEnabledRef + useCallback to avoid stale closures from gestures
// ✅ FIX: wire Settings -> Reset via FullscreenWrapper onReset
// ✅ Reset clears animations, state, timers, and stops audio
// ✅ FIX: Reset shield prevents late explosion callback from re-firing SFX + +1 counter

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Audio } from "expo-av";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import PremiumStage from "../../components/PremiumStage";
import GameHeader from "../../components/GameHeader";
import { frenzyTheme as t } from "../theme/frenzyTheme";
import { APP_IDENTITY } from "../../constants/appIdentity";

// ✅ Global sound manager (for Reset)
import { GlobalSoundManager } from "../../lib/soundManager";

// ✅ Shell-standard Settings hook
import { useSettingsUI } from "../../components/SettingsUIProvider";

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
const PRESSURE_MARGIN = 0.92;
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
const DRAG_SQUEEZE_THRESHOLD = 8; // px (tune 6–12)

// Drag containment margin (closer to edges than pressure)
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
// Flick / Swipe tuning (Phase IV)
// ---------------------------
// Minimum velocity magnitude to treat release as a flick
const FLICK_MIN_VELOCITY = 900; // px/s (tune 700–1200)

// Flick returns home immediately, but with the release velocity.
// This spring is slightly punchier than DRAG_SPRING so it feels like a "snap-back."
const FLICK_SPRING = { stiffness: 320, damping: 22 };

// ---------------------------
// Micro wall-hit feedback (Option A)
// ---------------------------
// Only tick when a FAST move hits the clamp; cooldown prevents buzzing.
const WALL_TICK_COOLDOWN_MS = 120;

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

// Core SFX
const SFX_SQUISH = require("../../assets/sounds/squish.mp3");
const SFX_POP = require("../../assets/sounds/pop.mp3");
const SFX_BUBBLE = require("../../assets/sounds/bubble.mp3");

// Utility: shuffle array (Fisher–Yates) — JS only
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------------------
// Reliable pooled SFX (Expo Go safe)
// ---------------------------
type SoundPool = {
  sounds: Audio.Sound[];
  idx: number;
};

async function createPool(source: any, size: number): Promise<SoundPool> {
  const sounds: Audio.Sound[] = [];
  for (let i = 0; i < size; i++) {
    const s = new Audio.Sound();
    await s.loadAsync(source, { shouldPlay: false, volume: 1.0 }, false);
    sounds.push(s);
  }
  return { sounds, idx: 0 };
}

async function unloadPool(pool: SoundPool | null) {
  if (!pool) return;
  await Promise.all(
    pool.sounds.map(async (s) => {
      try {
        await s.unloadAsync();
      } catch {}
    })
  );
}

async function playFromPool(pool: SoundPool | null) {
  if (!pool || pool.sounds.length === 0) return;
  const s = pool.sounds[pool.idx % pool.sounds.length];
  pool.idx = (pool.idx + 1) % pool.sounds.length;

  try {
    await s.setPositionAsync(0);
    await s.playAsync();
  } catch {}
}

export default function StressBallScreen() {
  // ✅ shell settings
  const settings = useSettingsUI();

  const soundEnabled =
    (settings as any).soundEnabled ?? (settings as any).soundOn ?? true;
  const openSettings =
    (settings as any).openSettings ??
    (settings as any).showSettings ??
    (settings as any).openSettingsModal ??
    (() => {});

  // ✅ keep latest sound state for gesture callbacks
  const soundEnabledRef = useRef<boolean>(!!soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = !!soundEnabled;
  }, [soundEnabled]);

  const [pressCount, setPressCount] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(0);

  // helper for UI-thread -> JS increments
  const incPressCount = () => setPressCount((p) => p + 1);

  // Shuffle bag for palette drift
  const bagRef = useRef<number[]>([]);
  const lastPaletteRef = useRef<number>(0);

  // Explosion pop sequence index
  const popSeqRef = useRef(0);

  // Delay timer for palette swap after explosion flash
  const paletteSwapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Reset shield timer (prevents late explosion callback from re-firing)
  const resetShieldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ pooled SFX
  const squishPoolRef = useRef<SoundPool | null>(null);
  const popPoolRef = useRef<SoundPool | null>(null);
  const bubblePoolRef = useRef<SoundPool | null>(null);
  const balloonPoolsRef = useRef<SoundPool[]>([]);
  const poolsReadyRef = useRef(false);

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

  // ✅ Shared stage dimensions for worklet math (gesture clamp detection)
  const stageWSV = useSharedValue(0);
  const stageHSV = useSharedValue(0);

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

  // Track whether the current drag should count as a squeeze
  const dragCountsSV = useSharedValue(false);

  // Shared pressuring flag (UI thread)
  const isPressuringSV = useSharedValue(0);

  // ✅ Micro wall-hit haptic state (UI thread)
  const lastWallTickTs = useSharedValue(0);
  const wasClampedSV = useSharedValue(false);

  // JS guards
  const isPressuringRef = useRef(false);
  const didExplodeRef = useRef(false);
  const didDragHapticRef = useRef(false);

  // ✅ JS haptic for wall tick (called via runOnJS)
  const wallTick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const playSfx = useCallback(async (kind: "squish" | "pop" | "bubble") => {
    if (!soundEnabledRef.current) return;
    if (!poolsReadyRef.current) return;

    try {
      if (kind === "squish") await playFromPool(squishPoolRef.current);
      if (kind === "pop") await playFromPool(popPoolRef.current);
      if (kind === "bubble") await playFromPool(bubblePoolRef.current);
    } catch {}
  }, []);

  const playBalloonPopSeq = useCallback(async () => {
    if (!soundEnabledRef.current) return;
    if (!poolsReadyRef.current) return;

    const idx = popSeqRef.current % BALLOON_POP_FILES.length;
    const pool = balloonPoolsRef.current[idx];
    popSeqRef.current = (idx + 1) % BALLOON_POP_FILES.length;

    try {
      await playFromPool(pool);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // seed bag
        lastPaletteRef.current = 0;
        bagRef.current = shuffle(
          Array.from({ length: BALL_PALETTES.length }, (_, i) => i).filter(
            (i) => i !== 0
          )
        );

        // build pools
        const [squishPool, popPool, bubblePool] = await Promise.all([
          createPool(SFX_SQUISH, 4),
          createPool(SFX_POP, 4),
          createPool(SFX_BUBBLE, 3),
        ]);

        const balloonPools: SoundPool[] = [];
        for (let i = 0; i < BALLOON_POP_FILES.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          balloonPools.push(await createPool(BALLOON_POP_FILES[i], 2));
        }

        if (cancelled) {
          await unloadPool(squishPool);
          await unloadPool(popPool);
          await unloadPool(bubblePool);
          await Promise.all(balloonPools.map(unloadPool));
          return;
        }

        squishPoolRef.current = squishPool;
        popPoolRef.current = popPool;
        bubblePoolRef.current = bubblePool;
        balloonPoolsRef.current = balloonPools;
        poolsReadyRef.current = true;

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
      } catch {
        poolsReadyRef.current = false;
      }
    })();

    return () => {
      cancelled = true;

      if (paletteSwapTimerRef.current) {
        clearTimeout(paletteSwapTimerRef.current);
        paletteSwapTimerRef.current = null;
      }

      if (resetShieldTimerRef.current) {
        clearTimeout(resetShieldTimerRef.current);
        resetShieldTimerRef.current = null;
      }

      (async () => {
        try {
          await unloadPool(squishPoolRef.current);
          await unloadPool(popPoolRef.current);
          await unloadPool(bubblePoolRef.current);
          await Promise.all(balloonPoolsRef.current.map(unloadPool));
        } catch {}
      })();
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

  const onTap = useCallback(async () => {
    if (isPressuringRef.current) return;

    scale.value = withSpring(TAP_SQUISH, { stiffness: 170, damping: 12 });

    await playSfx("squish");
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setPressCount((p) => p + 1);

    await playSfx("pop");
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    bumpBackToRest();
  }, [playSfx, scale]);

  const stepFX = useCallback(
    async (step: number) => {
      if (!isPressuringRef.current) return;
      if (didExplodeRef.current) return;

      try {
        if (step === 1) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await playSfx("squish");
        } else if (step === 2) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await playSfx("bubble");
        } else if (step === 3) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await playSfx("squish");
        } else if (step === 4) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      } catch {}
    },
    [playSfx]
  );

  const runExplosionFX = useCallback(async () => {
    // ✅ Reset shield: block any late calls after user hits Reset
    if (didExplodeRef.current) return;

    didExplodeRef.current = true;
    setPressCount((p) => p + 1);

    await playBalloonPopSeq();

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
  }, [isPressuringSV, playBalloonPopSeq]);

  const onPressureStart = useCallback(async () => {
    isPressuringRef.current = true;
    isPressuringSV.value = 1;
    didExplodeRef.current = false;
    pressureStep.value = 0;

    resetDrag();

    scale.value = withSpring(0.99, { stiffness: 140, damping: 16 });
    pressure.value = 0;
    explosion.value = 0;

    await playSfx("bubble");
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

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
  }, [explosion, explosionTrigger, isPressuringSV, playSfx, pressure, pressureStep, scale]);

  const onPressureRelease = useCallback(async () => {
    if (didExplodeRef.current) {
      isPressuringRef.current = false;
      isPressuringSV.value = 0;
      return;
    }

    setPressCount((p) => p + 1);

    cancelAnimation(pressure);
    pressure.value = withTiming(0, { duration: 140 });
    pressureStep.value = 0;

    await playSfx("pop");
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    bumpBackToRest();

    setTimeout(() => {
      isPressuringRef.current = false;
      isPressuringSV.value = 0;
    }, 60);
  }, [isPressuringSV, playSfx, pressure, pressureStep]);

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
  // Reset wiring (Settings -> Reset)
  // ---------------------------
  const handleReset = useCallback(() => {
    // ✅ Reset shield ON (blocks any late explosion callback)
    didExplodeRef.current = true;
    if (resetShieldTimerRef.current) clearTimeout(resetShieldTimerRef.current);
    resetShieldTimerRef.current = setTimeout(() => {
      didExplodeRef.current = false;
      resetShieldTimerRef.current = null;
    }, 350);

    // timers
    if (paletteSwapTimerRef.current) {
      clearTimeout(paletteSwapTimerRef.current);
      paletteSwapTimerRef.current = null;
    }

    // JS state + counters
    setPressCount(0);
    setPaletteIndex(0);

    // palette drift bag
    bagRef.current = [];
    lastPaletteRef.current = 0;

    // explosion seq
    popSeqRef.current = 0;

    // JS flags
    isPressuringRef.current = false;
    didDragHapticRef.current = false;

    // stop any playing audio (global + local pools)
    GlobalSoundManager.stopAll().catch(() => {});

    const stopPoolNow = (pool: SoundPool | null) => {
      if (!pool) return;
      pool.sounds.forEach((s) => {
        try {
          s.stopAsync().catch(() => {});
          s.setPositionAsync(0).catch(() => {});
        } catch {}
      });
    };

    stopPoolNow(squishPoolRef.current);
    stopPoolNow(popPoolRef.current);
    stopPoolNow(bubblePoolRef.current);
    balloonPoolsRef.current.forEach((p) => stopPoolNow(p));

    // cancel & reset animations/shared values
    cancelAnimation(scale);
    cancelAnimation(pressure);
    cancelAnimation(pulse);
    cancelAnimation(explosion);
    cancelAnimation(dragX);
    cancelAnimation(dragY);

    scale.value = 1;
    pressure.value = 0;
    pulse.value = 1;
    explosion.value = 0;
    pressureStep.value = 0;

    // ✅ clear queued explosion reaction source
    explosionTrigger.value = 0;

    dragX.value = 0;
    dragY.value = 0;

    isPressuringSV.value = 0;
    wasClampedSV.value = false;
    lastWallTickTs.value = 0;
    dragCountsSV.value = false;

    // restart idle pulse if enabled
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
  }, [
    dragCountsSV,
    dragX,
    dragY,
    explosion,
    explosionTrigger,
    isPressuringSV,
    lastWallTickTs,
    pressure,
    pressureStep,
    pulse,
    scale,
    wasClampedSV,
  ]);

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
      PRESSURE_INFLATE_MIN +
      (maxContainedScale - PRESSURE_INFLATE_MIN) * pressure.value;

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

    const dragScaleX =
      1 + (dragStretch - 1) * biasX + (dragSquash - 1) * biasY;
    const dragScaleY =
      1 + (dragStretch - 1) * biasY + (dragSquash - 1) * biasX;

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

      dragCountsSV.value = false;
      wasClampedSV.value = false;

      cancelAnimation(dragX);
      cancelAnimation(dragY);

      runOnJS(onDragBeginJS)();
    })
    .onUpdate((e) => {
      if (isPressuringSV.value > 0.5) return;

      dragX.value = e.translationX;
      dragY.value = e.translationY;

      const dist = Math.hypot(e.translationX, e.translationY);
      if (!dragCountsSV.value && dist > DRAG_SQUEEZE_THRESHOLD) {
        dragCountsSV.value = true;
      }

      // wall-hit micro haptic on FAST clamp
      const w = stageWSV.value > 0 ? stageWSV.value : BALL_SIZE * 1.9;
      const h = stageHSV.value > 0 ? stageHSV.value : BALL_SIZE * 2.4;

      const containedWDrag = w * DRAG_MARGIN;
      const containedHDrag = h * DRAG_MARGIN;

      const MAX_DRAG_STRETCH = 1 + DRAG_MAX_STRETCH + WALL_TENSION_STRETCH_ADD;
      const SAFE_BALL = BALL_SIZE * MAX_DRAG_STRETCH;

      const maxTx = Math.max(0, (containedWDrag - SAFE_BALL) / 2 - SAFE_EDGE_PAD);
      const maxTy = Math.max(0, (containedHDrag - SAFE_BALL) / 2 - SAFE_EDGE_PAD);

      const isClamped =
        Math.abs(e.translationX) > maxTx || Math.abs(e.translationY) > maxTy;

      const vMag = Math.hypot(e.velocityX ?? 0, e.velocityY ?? 0);
      const fastEnough = vMag >= FLICK_MIN_VELOCITY;

      if (isClamped && !wasClampedSV.value && fastEnough) {
        const now = Date.now();
        if (now - lastWallTickTs.value > WALL_TICK_COOLDOWN_MS) {
          lastWallTickTs.value = now;
          runOnJS(wallTick)();
        }
      }

      wasClampedSV.value = isClamped;
    })
    .onEnd((e) => {
      if (isPressuringSV.value > 0.5) return;

      if (dragCountsSV.value) {
        runOnJS(incPressCount)();
      }

      const vMag = Math.hypot(e.velocityX, e.velocityY);
      const isFlick = vMag > FLICK_MIN_VELOCITY;

      if (isFlick) {
        dragX.value = withSpring(0, { ...FLICK_SPRING, velocity: e.velocityX });
        dragY.value = withSpring(0, { ...FLICK_SPRING, velocity: e.velocityY });
        return;
      }

      dragX.value = withSpring(0, DRAG_SPRING);
      dragY.value = withSpring(0, DRAG_SPRING);
    })
    .onFinalize(() => {
      if (isPressuringSV.value > 0.5) return;

      dragCountsSV.value = false;
      wasClampedSV.value = false;
      runOnJS(onDragFinalizeJS)();
    });

  const pressGesture = Gesture.Exclusive(longPressGesture, tapGesture);
  const gesture = Gesture.Simultaneous(panGesture, pressGesture);

  const [c1, c2, c3] = BALL_PALETTES[paletteIndex] ?? BALL_PALETTES[0];
  const [h1, h2, h3] = BALL_HEAT_PALETTES[paletteIndex] ?? BALL_HEAT_PALETTES[0];

  return (
    <FullscreenWrapper appName={APP_IDENTITY.displayName} onReset={handleReset}>
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
              onPressSettings={() => openSettings()}
            />
          </View>

          <View style={styles.stageWrap}>
            <View style={styles.stageShell}>
              <PremiumStage
                showShine={false}
                style={{ backgroundColor: STRESS_STAGE_SURFACE }}
              >
                <View
                  style={styles.content}
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    if (width > 0 && Math.abs(width - stageW) > 2) setStageW(width);
                    if (height > 0 && Math.abs(height - stageH) > 2) setStageH(height);

                    if (width > 0) stageWSV.value = width;
                    if (height > 0) stageHSV.value = height;
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

          {/* ✅ no local SettingsModal; shell-standard settings handles it */}
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
