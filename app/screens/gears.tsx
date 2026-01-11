// app/screens/gears.tsx
// Fidget Frenzy — Gears (v0.9-dev)
//
// ✅ MIGRATION (Shell-standard):
// - Uses useSettingsUI() (no local SettingsModal)
// - Sound toggle persists globally
// - Audio loops stop immediately when sound disabled
// - Cleanup stops/unloads audio on unmount

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  ImageSourcePropType,
} from "react-native";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import GameHeader from "../../components/GameHeader";
import PremiumStage from "../../components/PremiumStage";

// ✅ Shell-standard Settings hook
import { useSettingsUI } from "../../components/SettingsUIProvider";

type SoundKey = "winding" | "unwinding";
type Mode = "idle" | "dragging" | "unwinding";

type GearAsset = {
  id: string;
  source: ImageSourcePropType;
  tier: "small" | "medium" | "large";
};

type PlacedGear = {
  id: string;
  source: ImageSourcePropType;
  size: number;
  cx: number;
  cy: number;
  left: number;
  top: number;
  // signed multiplier relative to DRIVER when direction === +1
  mult: number;
};

const DRIVER_SIZE = 260;

// ---- Wind/unwind feel knobs ----
const WIND_SENSITIVITY = 1.0;

const UNWIND_MS_PER_TURN = 220;
const UNWIND_MIN_MS = 260;
const UNWIND_MAX_MS = 30000;

// ✅ Drag idle stop: if finger is down but not moving, stop winding loop
const DRAG_IDLE_STOP_MS = 200;

// Gesture thresholds
const MOVE_THRESHOLD = 18;
const LONG_PRESS_MS = 450;

function normalizeDeltaRad(delta: number) {
  "worklet";
  const PI2 = Math.PI * 2;
  let d = delta % PI2;
  if (d > Math.PI) d -= PI2;
  if (d < -Math.PI) d += PI2;
  return d;
}

function turnsFromDeltaRad(dA: number) {
  "worklet";
  return (dA / (Math.PI * 2)) * WIND_SENSITIVITY;
}

// ✅ Worklet-safe clamp (DO NOT call plain JS helpers from worklets)
function clampWorklet(n: number, lo: number, hi: number) {
  "worklet";
  return Math.max(lo, Math.min(hi, n));
}

// ---- Small helper component so we can use hooks per gear (no hooks-in-loop) ----
function FollowerGear({
  g,
  spinTurns,
  directionSV,
}: {
  g: PlacedGear;
  spinTurns: SharedValue<number>;
  directionSV: SharedValue<1 | -1>;
}) {
  const rotateDeg = useDerivedValue(() => {
    const signedMult = g.mult * directionSV.value;
    const turns = spinTurns.value * signedMult; // turns (can be negative)
    return `${turns * 360}deg`;
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: rotateDeg.value }],
  }));

  return (
    <Animated.Image
      source={g.source}
      resizeMode="contain"
      style={[
        styles.img,
        {
          width: g.size,
          height: g.size,
          left: g.left,
          top: g.top,
        },
        style,
      ]}
    />
  );
}

export default function Gears() {
  // ✅ Shell settings (matches your naming style)
  const { soundOn, openSettings } = useSettingsUI();
  const soundOnRef = useRef(soundOn);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const [mode, setMode] = useState<Mode>("idle");
  const modeRef = useRef<Mode>("idle");

  // UI-thread motion state (turns, unbounded)
  const spinTurns = useSharedValue(0); // turns
  const restTurns = useSharedValue(0); // unwind target baseline (captured on begin)
  const directionSV = useSharedValue<1 | -1>(1);

  // drag state
  const isDragging = useSharedValue(false);
  const movedSV = useSharedValue(false);

  const dragStartTurns = useSharedValue(0);
  const prevAngle = useSharedValue(0); // rad
  const cumulativeTurns = useSharedValue(0);

  // driver center in screen coords for atan2 (like Spinner)
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);

  const driverRef = useRef<View>(null);

  const [direction, setDirection] = useState<1 | -1>(1);

  // React UI state
  const [power, setPower] = useState(0);

  // Timers (JS)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setModeNow = useCallback((next: Mode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  // ---- Audio ----
  const soundsRef = useRef<Record<SoundKey, Audio.Sound | null>>({
    winding: null,
    unwinding: null,
  });
  const audioReadyRef = useRef(false);

  const safeStartLoop = useCallback(async (key: SoundKey) => {
    if (!soundOnRef.current) return;
    const s = soundsRef.current[key];
    if (!audioReadyRef.current || !s) return;

    try {
      const status = await s.getStatusAsync();
      const isPlaying = (status as any)?.isPlaying === true;

      await s.setIsLoopingAsync(true);
      if (!isPlaying) {
        await s.setPositionAsync(0);
        await s.playAsync();
      }
    } catch {}
  }, []);

  const safeStop = useCallback(async (key: SoundKey) => {
    const s = soundsRef.current[key];
    if (!audioReadyRef.current || !s) return;

    try {
      await s.stopAsync();
      await s.setIsLoopingAsync(false);
      await s.setPositionAsync(0);
    } catch {}
  }, []);

  const stopAllAudio = useCallback(() => {
    void safeStop("winding");
    void safeStop("unwinding");
  }, [safeStop]);

  // ✅ If sound gets disabled while we’re mid-loop, slam-stop immediately
  useEffect(() => {
    if (!soundOn) stopAllAudio();
  }, [soundOn, stopAllAudio]);

  // ---- Audio load/unload ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const winding = await Audio.Sound.createAsync(
          require("../../assets/sounds/gear-winding.mp3"),
          { shouldPlay: false, volume: 1.0 }
        );
        const unwinding = await Audio.Sound.createAsync(
          require("../../assets/sounds/gear-unwinding.mp3"),
          { shouldPlay: false, volume: 1.0 }
        );

        if (cancelled) {
          await winding.sound.unloadAsync();
          await unwinding.sound.unloadAsync();
          return;
        }

        soundsRef.current.winding = winding.sound;
        soundsRef.current.unwinding = unwinding.sound;
        audioReadyRef.current = true;
      } catch {
        audioReadyRef.current = false;
        soundsRef.current.winding = null;
        soundsRef.current.unwinding = null;
      }
    })();

    // start clean
    spinTurns.value = 0;
    restTurns.value = 0;
    directionSV.value = 1;
    setDirection(1);
    setPower(0);
    setModeNow("idle");

    return () => {
      cancelled = true;

      stopAllAudio();

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (idleStopTimerRef.current) {
        clearTimeout(idleStopTimerRef.current);
        idleStopTimerRef.current = null;
      }

      (async () => {
        try {
          audioReadyRef.current = false;
          const { winding, unwinding } = soundsRef.current;
          if (winding) await winding.unloadAsync();
          if (unwinding) await unwinding.unloadAsync();
        } catch {} finally {
          soundsRef.current.winding = null;
          soundsRef.current.unwinding = null;
        }
      })();
    };
  }, [setModeNow, stopAllAudio, spinTurns, restTurns, directionSV]);

  // ---- Power meter (throttled via derived value) ----
  // Power = tenths of a turn away from rest
  const powerTenths = useDerivedValue(() => {
    const turnsAway = Math.abs(spinTurns.value - restTurns.value);
    const p = Math.min(9999, Math.round(turnsAway * 10));
    return p;
  });

  // Throttle React updates to avoid unnecessary re-renders
  const powerThrottleRef = useRef({ lastTs: 0, lastP: -1 });
  useEffect(() => {
    const id = setInterval(() => {
      const p = powerTenths.value;
      const now = Date.now();
      const { lastTs, lastP } = powerThrottleRef.current;
      if (now - lastTs < 80) return;
      if (p !== lastP) {
        powerThrottleRef.current.lastP = p;
        powerThrottleRef.current.lastTs = now;
        setPower(p);
      } else {
        powerThrottleRef.current.lastTs = now;
      }
    }, 50);

    return () => clearInterval(id);
  }, [powerTenths]);

  // ---------------- Stage measurement ----------------
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Center/bottom with slight left bias (right-handed use)
  const DRIVER_LEFT_BIAS_PX = -40;
  const DRIVER_BOTTOM_PAD_PX = 220;

  const driverCenterX = stageSize.w > 0 ? stageSize.w / 2 + DRIVER_LEFT_BIAS_PX : 0;
  const driverCenterY = stageSize.h > 0 ? stageSize.h - DRIVER_BOTTOM_PAD_PX : 0;

  const measureDriverCenter = useCallback(() => {
    setTimeout(() => {
      driverRef.current?.measureInWindow((x, y, w, h) => {
        centerX.value = x + w / 2;
        centerY.value = y + h / 2;
      });
    }, 0);
  }, [centerX, centerY]);

  // ---------------- Assets ----------------
  const DRIVER_SOURCE = useMemo(
    () => require("../../assets/gears/gear_gold_large.png"),
    []
  );

  const BASE_ASSETS: GearAsset[] = useMemo(
    () => [
      { id: "silver_large", source: require("../../assets/gears/gear_silver_large.png"), tier: "large" },
      { id: "silver_medium", source: require("../../assets/gears/gear_silver_medium.png"), tier: "medium" },

      { id: "silver_small", source: require("../../assets/gears/gear_silver_small.png"), tier: "small" },
      { id: "gunmetal_small", source: require("../../assets/gears/gear_gunmetal_small.png"), tier: "small" },
      { id: "dark_small", source: require("../../assets/gears/gear_dark_small.png"), tier: "small" },
      { id: "bright_small", source: require("../../assets/gears/gear_bright_small.png"), tier: "small" },
    ],
    []
  );

  // ---------------- Helpers ----------------
  const randomIn = (min: number, max: number) => min + Math.random() * (max - min);
  const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);

  const pickFollowerSize = (tier: GearAsset["tier"]) => {
    if (tier === "large") return Math.round(randomIn(175, 205));
    if (tier === "medium") return Math.round(randomIn(130, 160));
    return Math.round(randomIn(90, 120));
  };

  // ---------------- Random layout engine ----------------
  const [placed, setPlaced] = useState<PlacedGear[]>([]);

  const generateLayout = useCallback(
    (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;

      const driver: PlacedGear = {
        id: "gold_driver",
        source: DRIVER_SOURCE,
        size: DRIVER_SIZE,
        cx: driverCenterX,
        cy: driverCenterY,
        left: driverCenterX - DRIVER_SIZE / 2,
        top: driverCenterY - DRIVER_SIZE / 2,
        mult: 1,
      };

      const margin = 18;
      const biteBase = 7;
      const MULTI_CONTACT_TOLERANCE_PX = 6;

      const withinBounds = (cx: number, cy: number, r: number) =>
        cx - r >= margin && cx + r <= w - margin && cy - r >= margin && cy + r <= h - margin;

      const violatesSingleContact = (
        cx: number,
        cy: number,
        rNew: number,
        parentId: string,
        existing: PlacedGear[]
      ) => {
        for (const g of existing) {
          if (g.id === parentId) continue;
          const r2 = g.size / 2;
          const d = dist(cx, cy, g.cx, g.cy);
          if (d <= rNew + r2 + MULTI_CONTACT_TOLERANCE_PX) return true;
        }
        return false;
      };

      const pickAngleDeg = () => {
        const roll = Math.random();
        if (roll < 0.78) return randomIn(-175, 35);
        if (roll < 0.95) return randomIn(35, 165);
        return randomIn(165, 330);
      };

      const SMALL_DUPES = 2;
      const EXTRA_RANDOM_SMALL = 2;

      const large = BASE_ASSETS.filter((a) => a.tier === "large");
      const medium = BASE_ASSETS.filter((a) => a.tier === "medium");
      const smalls = BASE_ASSETS.filter((a) => a.tier === "small");

      const followerPool: GearAsset[] = [];

      if (large[0]) followerPool.push({ ...large[0] });
      if (medium[0]) followerPool.push({ ...medium[0] });

      for (const s of smalls) {
        for (let i = 0; i < SMALL_DUPES; i++) {
          followerPool.push({ ...s, id: `${s.id}_dup${i + 1}` });
        }
      }

      for (let i = 0; i < EXTRA_RANDOM_SMALL; i++) {
        const pick = smalls[Math.floor(randomIn(0, smalls.length))];
        followerPool.push({ ...pick, id: `${pick.id}_extra${i + 1}` });
      }

      const placedGears: PlacedGear[] = [driver];
      const followers = [...followerPool].sort(() => Math.random() - 0.5);

      for (const asset of followers) {
        const size = pickFollowerSize(asset.tier);
        const rNew = size / 2;

        let best: PlacedGear | null = null;

        for (let t = 0; t < 220; t++) {
          const parent =
            Math.random() < 0.5
              ? placedGears[0]
              : placedGears[Math.floor(randomIn(0, placedGears.length))];

          const rP = parent.size / 2;
          const bite = biteBase + (asset.tier === "large" ? 2 : 0);
          const centerDist = rP + rNew - bite;

          const th = (pickAngleDeg() * Math.PI) / 180;
          const cx = parent.cx + Math.cos(th) * centerDist;
          const cy = parent.cy + Math.sin(th) * centerDist;

          if (!withinBounds(cx, cy, rNew)) continue;
          if (violatesSingleContact(cx, cy, rNew, parent.id, placedGears)) continue;

          const ratio = parent.size / size;
          const mult = parent.mult * (-ratio);

          best = {
            id: asset.id,
            source: asset.source,
            size,
            cx,
            cy,
            left: cx - rNew,
            top: cy - rNew,
            mult,
          };
          break;
        }

        if (best) placedGears.push(best);
      }

      setPlaced(placedGears.filter((g) => g.id !== "gold_driver"));
    },
    [BASE_ASSETS, DRIVER_SOURCE, driverCenterX, driverCenterY]
  );

  useEffect(() => {
    if (stageSize.w <= 0 || stageSize.h <= 0) return;
    generateLayout(stageSize.w, stageSize.h);
  }, [generateLayout, stageSize.h, stageSize.w]);

  // ---------------- Direction sync (React state + SharedValue) ----------------
  const reverseNow = useCallback(() => {
    if (modeRef.current === "dragging" || modeRef.current === "unwinding") return;
    setDirection((prev) => (prev === 1 ? -1 : 1));
  }, []);

  useEffect(() => {
    directionSV.value = direction;
  }, [direction, directionSV]);

  // ---------------- Timers (JS) ----------------
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearIdleStopTimer = useCallback(() => {
    if (idleStopTimerRef.current) {
      clearTimeout(idleStopTimerRef.current);
      idleStopTimerRef.current = null;
    }
  }, []);

  const scheduleIdleStop = useCallback(() => {
    clearIdleStopTimer();
    idleStopTimerRef.current = setTimeout(() => {
      if (modeRef.current !== "dragging") return;
      void safeStop("winding");
    }, DRAG_IDLE_STOP_MS);
  }, [clearIdleStopTimer, safeStop]);

  const scheduleLongPressReverse = useCallback(() => {
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      if (modeRef.current !== "idle") return;
      void safeStop("winding");
      void safeStop("unwinding");
      reverseNow();
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer, reverseNow, safeStop]);

  // ---------------- Gesture (UI thread) ----------------
  const pan = useMemo(() => {
    return Gesture.Pan()
      .onBegin((e) => {
        "worklet";
        cancelAnimation(spinTurns);

        // ✅ Capture unwind baseline at touch begin (matches old behavior)
        restTurns.value = spinTurns.value;

        isDragging.value = true;
        movedSV.value = false;

        dragStartTurns.value = spinTurns.value;
        cumulativeTurns.value = 0;

        const dx = e.absoluteX - centerX.value;
        const dy = e.absoluteY - centerY.value;
        prevAngle.value = Math.atan2(dy, dx);

        runOnJS(setModeNow)("idle");
        runOnJS(stopAllAudio)();
        runOnJS(scheduleLongPressReverse)();
        runOnJS(clearIdleStopTimer)();
      })
      .onChange((e) => {
        "worklet";
        if (!isDragging.value) return;

        const dxAbs = Math.abs(e.translationX);
        const dyAbs = Math.abs(e.translationY);

        if (!movedSV.value) {
          if (dxAbs + dyAbs < MOVE_THRESHOLD) return;

          movedSV.value = true;
          runOnJS(clearLongPressTimer)();
          runOnJS(setModeNow)("dragging");
          runOnJS(safeStop)("unwinding");
          runOnJS(safeStartLoop)("winding");
        }

        runOnJS(scheduleIdleStop)();

        const dx = e.absoluteX - centerX.value;
        const dy = e.absoluteY - centerY.value;
        const a = Math.atan2(dy, dx);

        const dA = normalizeDeltaRad(a - prevAngle.value);
        prevAngle.value = a;

        cumulativeTurns.value += turnsFromDeltaRad(dA);

        const dirMul = directionSV.value === 1 ? 1 : -1;
        spinTurns.value = dragStartTurns.value + cumulativeTurns.value * dirMul;
      })
      .onEnd(() => {
        "worklet";
        runOnJS(clearLongPressTimer)();
        runOnJS(clearIdleStopTimer)();

        isDragging.value = false;

        if (!movedSV.value) {
          runOnJS(stopAllAudio)();
          runOnJS(setModeNow)("idle");
          return;
        }

        runOnJS(setModeNow)("unwinding");
        runOnJS(safeStop)("winding");
        runOnJS(safeStartLoop)("unwinding");

        const from = spinTurns.value;
        const rest = restTurns.value;
        const turnsAway = Math.abs(from - rest);

        const duration = clampWorklet(
          turnsAway * UNWIND_MS_PER_TURN,
          UNWIND_MIN_MS,
          UNWIND_MAX_MS
        );

        spinTurns.value = withTiming(
          rest,
          {
            duration,
            easing: (t) => {
              "worklet";
              const inv = 1 - t;
              return 1 - inv * inv * inv; // outCubic
            },
          },
          (finished) => {
            "worklet";
            if (!finished) return;
            runOnJS(setModeNow)("idle");
            runOnJS(safeStop)("unwinding");
          }
        );
      })
      .onFinalize(() => {
        "worklet";
        runOnJS(clearLongPressTimer)();
        runOnJS(clearIdleStopTimer)();
      });
  }, [
    centerX,
    centerY,
    clearIdleStopTimer,
    clearLongPressTimer,
    cumulativeTurns,
    directionSV,
    dragStartTurns,
    isDragging,
    movedSV,
    prevAngle,
    restTurns,
    safeStartLoop,
    safeStop,
    scheduleIdleStop,
    scheduleLongPressReverse,
    setModeNow,
    spinTurns,
    stopAllAudio,
  ]);

  // Driver rotation style
  const driverRotate = useDerivedValue(() => `${spinTurns.value * 360}deg`);
  const driverStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: driverRotate.value }],
  }));

  const reset = useCallback(() => {
    stopAllAudio();

    clearLongPressTimer();
    clearIdleStopTimer();

    cancelAnimation(spinTurns);
    spinTurns.value = 0;
    restTurns.value = 0;
    directionSV.value = 1;

    setDirection(1);
    setModeNow("idle");
    setPower(0);

    if (stageSize.w > 0 && stageSize.h > 0) {
      generateLayout(stageSize.w, stageSize.h);
    }

    measureDriverCenter();
  }, [
    clearIdleStopTimer,
    clearLongPressTimer,
    generateLayout,
    measureDriverCenter,
    setModeNow,
    stageSize.h,
    stageSize.w,
    stopAllAudio,
    spinTurns,
    restTurns,
    directionSV,
  ]);

  // ---------------- Stage measurement ----------------
  const [stageSizeState, setStageSizeState] = useState({ w: 0, h: 0 });
  useEffect(() => {
    setStageSize(stageSizeState);
  }, [stageSizeState]);

  return (
    <FullscreenWrapper>
      <View style={[styles.root, { backgroundColor: "#0B0B0F" }]}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* HEADER (standardized) */}
          <View style={styles.headerWrap}>
            <GameHeader
              left={<BackButton />}
              centerLabel="Power:"
              centerValue={power / 10}
              onPressSettings={openSettings}
            />
          </View>

          {/* STAGE */}
          <View style={styles.stageWrap}>
            <PremiumStage
              showShine={false}
              style={{ backgroundColor: "#161824" }}
            >
              <View
                style={styles.stageInner}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setStageSizeState({ w: width, h: height });
                  measureDriverCenter();
                }}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.00)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={styles.stageGlow} />

                {placed.map((g) => (
                  <FollowerGear
                    key={g.id}
                    g={g}
                    spinTurns={spinTurns}
                    directionSV={directionSV}
                  />
                ))}

                <GestureDetector gesture={pan}>
                  <View
                    ref={driverRef}
                    onLayout={measureDriverCenter}
                    style={[
                      styles.img,
                      {
                        width: DRIVER_SIZE,
                        height: DRIVER_SIZE,
                        left: driverCenterX - DRIVER_SIZE / 2,
                        top: driverCenterY - DRIVER_SIZE / 2,
                      },
                    ]}
                  >
                    <Animated.View
                      style={[{ width: "100%", height: "100%" }, driverStyle]}
                    >
                      <Animated.Image
                        source={DRIVER_SOURCE}
                        resizeMode="contain"
                        style={{ width: "100%", height: "100%" }}
                      />
                    </Animated.View>
                  </View>
                </GestureDetector>
              </View>
            </PremiumStage>
          </View>
        </SafeAreaView>
      </View>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },

  stageWrap: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
  },

  stageInner: {
    flex: 1,
  },

  stageGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: "rgba(253, 208, 23, 0.035)",
    shadowColor: "#FDD017",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },

  img: { position: "absolute" },
});
