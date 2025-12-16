// Fidget Frenzy – Gears v0.9-dev (STABLE, CLEAN, NON-INSANE)
// Fixes:
// - Visual clumping: deterministic ring layout around gold gear (no random piles)
// - Power decay: power updates while unwinding (frame loop), not only during drag
// - Sound spam: click SFX driven by rotation "ticks" (not pan move spam)
// - Wind loop only while dragging, unwind once on release
// - Stops all Gears audio on screen blur (navigation)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  TouchableOpacity,
  Text,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import {
  playSound,
  preloadSounds,
  playLoopPersistent,
  GlobalSoundManager,
} from "../../lib/soundManager";

// ---- Assets ----
const IMG = {
  gold: require("../../assets/gears/gear_gold_large.png"),
  silverL: require("../../assets/gears/gear_silver_large.png"),
  silverM: require("../../assets/gears/gear_silver_medium.png"),
  silverS: require("../../assets/gears/gear_silver_small.png"),
  gunS: require("../../assets/gears/gear_gunmetal_small.png"),
  darkS: require("../../assets/gears/gear_dark_small.png"),
  brightS: require("../../assets/gears/gear_bright_small.png"),
};

const GEAR_POOL = [
  IMG.silverL,
  IMG.silverM,
  IMG.silverS,
  IMG.gunS,
  IMG.darkS,
  IMG.brightS,
];

// ---- Sounds ----
const SFX_CLICK_ID = "gearClick";
const SFX_CLICK_SRC = require("../../assets/sounds/gear-click.mp3");

const SFX_WIND_ID = "gearWind";
const SFX_WIND_SRC = require("../../assets/sounds/gear-winding.mp3");

const SFX_UNWIND_ID = "gearUnwind";
const SFX_UNWIND_SRC = require("../../assets/sounds/gear-unwinding.mp3");

// ---------- Types ----------
type Gear = {
  id: string;
  src: any;
  x: number;
  y: number;
  size: number;
  r: number;
  dir: 1 | -1;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// ---------- Gear Item ----------
function GearItem({
  gear,
  baseAngleDeg,
}: {
  gear: Gear;
  baseAngleDeg: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${baseAngleDeg.value * gear.dir}deg` }],
  }));

  return (
    <Animated.Image
      source={gear.src}
      resizeMode="contain"
      style={[
        styles.gear,
        style,
        { left: gear.x, top: gear.y, width: gear.size, height: gear.size },
      ]}
    />
  );
}

// ======================================================
//  MAIN
// ======================================================
export default function GearsScreen() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [power, setPower] = useState(0);

  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // Measure real usable size (avoid Dimensions pitfalls)
  const [layout, setLayout] = useState<{ w: number; h: number } | null>(null);

  // Rotation model
  const goldAngleDeg = useSharedValue(0);
  const goldOmega = useSharedValue(0); // deg/sec
  const isDragging = useSharedValue(0);

  // Drag angle baseline
  const prevAngleRef = useRef<number | null>(null);

  // Click tick model: play a click every N degrees of rotation while dragging
  const clickAccumDeg = useSharedValue(0);

  // Throttle power UI updates (avoid runOnJS spam)
  const powerUpdateMs = useSharedValue(0);

  // -------------------------
  // Preload sounds
  // -------------------------
  useEffect(() => {
    preloadSounds({
      [SFX_CLICK_ID]: SFX_CLICK_SRC,
      [SFX_WIND_ID]: SFX_WIND_SRC,
      [SFX_UNWIND_ID]: SFX_UNWIND_SRC,
    });
  }, []);

  // -------------------------
  // Audio control helpers
  // -------------------------
  const stopAllGearsAudio = useCallback(() => {
    void GlobalSoundManager.stop(SFX_CLICK_ID);
    void GlobalSoundManager.stop(SFX_WIND_ID);
    void GlobalSoundManager.stop(SFX_UNWIND_ID);
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopAllGearsAudio();
      };
    }, [stopAllGearsAudio])
  );

  useEffect(() => {
    if (!soundOn) stopAllGearsAudio();
  }, [soundOn, stopAllGearsAudio]);

  const startWindLoop = () => {
    if (!soundOnRef.current) return;
    void playLoopPersistent(SFX_WIND_ID, SFX_WIND_SRC, 0.8);
  };

  const stopWindLoop = () => {
    void GlobalSoundManager.stop(SFX_WIND_ID);
  };

  const playUnwind = () => {
    if (!soundOnRef.current) return;
    void playSound(SFX_UNWIND_ID, SFX_UNWIND_SRC);
  };

  const playClick = () => {
    if (!soundOnRef.current) return;
    // Using playSound for click is OK because we trigger it sparingly via ticks
    void playSound(SFX_CLICK_ID, SFX_CLICK_SRC);
  };

  // -------------------------
  // Deterministic gear layout
  // -------------------------
  const gears: Gear[] = useMemo(() => {
    if (!layout) return [];
    const { w, h } = layout;
    const min = Math.min(w, h);

    const SIZES = {
      GOLD: min * 0.40,
      L: min * 0.20,
      M: min * 0.16,
      S: min * 0.12,
    };

    // Place gold gear in a visually pleasing spot (not hugging bottom)
    const goldCx = w * 0.50;
    const goldCy = h * 0.65;

    const GOLD: Gear = {
      id: "gold",
      src: IMG.gold,
      size: SIZES.GOLD,
      r: SIZES.GOLD / 2,
      x: goldCx - SIZES.GOLD / 2,
      y: goldCy - SIZES.GOLD / 2,
      dir: 1,
    };

    const ring = (
      idPrefix: string,
      count: number,
      ringRadius: number,
      size: number,
      dir: 1 | -1,
      startAngle: number
    ) => {
      const out: Gear[] = [];
      const r = size / 2;

      for (let i = 0; i < count; i++) {
        const ang = startAngle + (i * Math.PI * 2) / count;
        const cx = goldCx + Math.cos(ang) * ringRadius;
        const cy = goldCy + Math.sin(ang) * ringRadius;

        // Keep within bounds (soft clamp)
        const x = clamp(cx - r, -10, w - size + 10);
        const y = clamp(cy - r, 40, h - size + 10);

        out.push({
          id: `${idPrefix}-${i}`,
          src: GEAR_POOL[(i + 2) % GEAR_POOL.length],
          x,
          y,
          size,
          r,
          dir,
        });
      }

      return out;
    };

    // Ring 1: interlocked, medium gears
    const ring1Radius = GOLD.r + SIZES.M / 2 - 4;
    const ring1 = ring("r1", 8, ring1Radius, SIZES.M, -1, -Math.PI / 2);

    // Ring 2: outer ring, small gears
    const ring2Radius = ring1Radius + SIZES.M / 2 + SIZES.S / 2 - 6;
    const ring2 = ring("r2", 12, ring2Radius, SIZES.S, 1, -Math.PI / 2 + Math.PI / 12);

    // A couple accent gears for depth (optional, but looks good)
    const accents: Gear[] = [
      {
        id: "accent-1",
        src: IMG.darkS,
        size: SIZES.S,
        r: SIZES.S / 2,
        x: clamp(w * 0.18 - SIZES.S / 2, -10, w - SIZES.S + 10),
        y: clamp(h * 0.62 - SIZES.S / 2, 40, h - SIZES.S + 10),
        dir: -1,
      },
      {
        id: "accent-2",
        src: IMG.gunS,
        size: SIZES.S,
        r: SIZES.S / 2,
        x: clamp(w * 0.82 - SIZES.S / 2, -10, w - SIZES.S + 10),
        y: clamp(h * 0.72 - SIZES.S / 2, 40, h - SIZES.S + 10),
        dir: -1,
      },
    ];

    return [GOLD, ...ring1, ...ring2, ...accents];
  }, [layout]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!width || !height) return;
    setLayout((prev) => {
      if (prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1) return prev;
      return { w: width, h: height };
    });
  };

  // -------------------------
  // Pan logic (only gold gear is interactive)
  // -------------------------
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,

        onPanResponderGrant: (_, g) => {
          if (!layout) return;
          const GOLD = gears[0];
          if (!GOLD) return;

          const cx = GOLD.x + GOLD.r;
          const cy = GOLD.y + GOLD.r;

          const dx = g.x0 - cx;
          const dy = g.y0 - cy;
          const dist = Math.hypot(dx, dy);

          // only grab if touching near the gold gear
          if (dist <= GOLD.r * 1.15) {
            isDragging.value = 1;
            prevAngleRef.current = Math.atan2(dy, dx);
            clickAccumDeg.value = 0;

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            startWindLoop();
          } else {
            prevAngleRef.current = null;
          }
        },

        onPanResponderMove: (_, g) => {
          const GOLD = gears[0];
          if (!GOLD) return;
          if (prevAngleRef.current == null) return;

          const cx = GOLD.x + GOLD.r;
          const cy = GOLD.y + GOLD.r;

          const dx = g.moveX - cx;
          const dy = g.moveY - cy;

          const ang = Math.atan2(dy, dx);
          let delta = ang - prevAngleRef.current;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;

          const deg = (delta * 180) / Math.PI;

          // Wind-up impulse
          const GAIN = 220;
          goldOmega.value += deg * GAIN;

          // Click ticks: one click every ~18 degrees of rotation input
          clickAccumDeg.value += Math.abs(deg);
          if (clickAccumDeg.value >= 18) {
            clickAccumDeg.value = 0;
            runOnJS(playClick)();
          }

          prevAngleRef.current = ang;
        },

        onPanResponderRelease: () => {
          prevAngleRef.current = null;
          isDragging.value = 0;
          stopWindLoop();
          playUnwind();
        },

        onPanResponderTerminate: () => {
          prevAngleRef.current = null;
          isDragging.value = 0;
          stopWindLoop();
          playUnwind();
        },

        onPanResponderTerminationRequest: () => false,
      }),
    [gears, layout]
  );

  // -------------------------
  // Frame loop: integrate + unwind + power decay
  // -------------------------
  useFrameCallback((frame) => {
    "worklet";

    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    if (dt <= 0) return;

    // integrate rotation
    goldAngleDeg.value += goldOmega.value * dt;

    // unwind when not dragging
    if (isDragging.value === 0) {
      const DAMP = 0.86; // stronger than before so it "powers down"
      goldOmega.value *= Math.pow(DAMP, dt);

      if (Math.abs(goldOmega.value) < 8) {
        goldOmega.value = 0;
      }
    }

    // Update POWER UI ~10x/sec
    powerUpdateMs.value += dt * 1000;
    if (powerUpdateMs.value >= 100) {
      powerUpdateMs.value = 0;

      const p = Math.floor(clamp(Math.abs(goldOmega.value) / 20, 0, 999));
      runOnJS(setPower)(p);
    }
  });

  const reset = () => {
    goldOmega.value = 0;
    goldAngleDeg.value = 0;
    isDragging.value = 0;
    prevAngleRef.current = null;
    clickAccumDeg.value = 0;
    setPower(0);
    stopAllGearsAudio();
  };

  return (
    <FullscreenWrapper>
      <View style={styles.container} onLayout={onLayout} {...panResponder.panHandlers}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <TouchableOpacity onPress={() => setSettingsVisible(true)}>
            <Ionicons name="settings-sharp" size={30} color="#FDD017" />
          </TouchableOpacity>
        </View>

        {/* Power Display */}
        <View style={styles.powerWrap} pointerEvents="none">
          <Text style={styles.powerLabel}>POWER</Text>
          <Text style={styles.powerValue}>{power}</Text>
        </View>

        {/* Gears */}
        {gears.map((gear) => (
          <GearItem key={gear.id} gear={gear} baseAngleDeg={goldAngleDeg} />
        ))}

        {/* Settings Modal */}
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onReset={reset}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
        />
      </View>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  gear: { position: "absolute" },

  header: {
    position: "absolute",
    top: 28,
    left: 18,
    right: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 12,
    alignItems: "center",
  },

  powerWrap: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    alignItems: "center",
    zIndex: 10,
  },
  powerLabel: {
    color: "#FDD017",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1,
  },
  powerValue: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 42,
    lineHeight: 46,
  },
});
