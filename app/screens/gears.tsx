// Fidget Frenzy – Gears v0.9-dev (Interlock tuned, Spinner header, wind→unwind SFX)
// Thumb-focused layout, organic cluster, correct interlocking, strong unwind.
// Slide-off fix: sliding off gold gear now behaves like release WITHOUT zeroing power.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, PanResponder } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";

const { width: W, height: H } = Dimensions.get("window");
const SHORT_SIDE = Math.min(W, H);

const BRAND = {
  blue: "#0B1E3D",
  gold: "#FDD017",
  silver: "#C0C0C0",
};

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

const GEAR_POOL_MED = [IMG.silverL, IMG.silverM];
const GEAR_POOL_SMALL = [IMG.silverS, IMG.gunS, IMG.darkS, IMG.brightS];

// Sizes – tuned for visibility & thumb-friendly layout
const SIZES = {
  GOLD: SHORT_SIDE * 0.48,
  L: SHORT_SIDE * 0.30,
  M: SHORT_SIDE * 0.22,
  S: SHORT_SIDE * 0.16,
};

type GearConfig = {
  id: string;
  src: any;
  x: number;
  y: number;
  size: number;
  dir: number;
  speed: number;
  isGold?: boolean;
};

type InternalGear = {
  id: string;
  src: any;
  cx: number;
  cy: number;
  r: number;
  dir: number;
  speed: number;
};

// ---------------------------------------------------------
// GEAR ITEM
// ---------------------------------------------------------
function GearItem({ gear, goldAngle }: { gear: GearConfig; goldAngle: any }) {
  const style = useAnimatedStyle(() => {
    const angle = goldAngle.value * gear.speed * gear.dir;
    return { transform: [{ rotate: `${angle}deg` }] };
  });

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

// ---------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------
export default function GearsScreen() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [power, setPower] = useState(0);

  const goldAngle = useSharedValue(0);

  const energyRef = useRef(0);
  const powerRef = useRef(0);

  const draggingRef = useRef(false);
  const hadGoldTouchRef = useRef(false);
  const prevAngleRef = useRef<number | null>(null);

  // Movement thresholds + jitter lock
  const MIN_MOVE_TO_START = 0.4;
  const MIN_MOVE_TO_STOP = 0.1;
  const PAUSE_STABILIZE_MS = 40;

  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoveTimeRef = useRef(Date.now());

  // Audio sound refs
  const windSoundRef = useRef<Audio.Sound | null>(null);
  const unwindSoundRef = useRef<Audio.Sound | null>(null);

  // Audio mutex/tokens
  const audioLockRef = useRef<"none" | "wind" | "unwind">("none");
  const windPlayIdRef = useRef(0);
  const unwindPlayIdRef = useRef(0);

  // Unwind state
  const isUnwindingRef = useRef(false);
  const unwindStartEnergyRef = useRef(0);
  const unwindDurationRef = useRef(0);
  const unwindElapsedRef = useRef(0);

  // -------------------------------------------------------
  // LOAD / UNLOAD SOUNDS
  // -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [windResult, unwindResult] = await Promise.all([
          Audio.Sound.createAsync(
            require("../../assets/sounds/gear-winding.mp3"),
            { isLooping: true, volume: 1.0 }
          ),
          Audio.Sound.createAsync(
            require("../../assets/sounds/gear-unwinding.mp3"),
            { isLooping: false, volume: 1.0 }
          ),
        ]);

        if (!cancelled) {
          windSoundRef.current = windResult.sound;
          unwindSoundRef.current = unwindResult.sound;
        } else {
          await windResult.sound.unloadAsync();
          await unwindResult.sound.unloadAsync();
        }
      } catch {
        // fail silently, game still runs without audio
      }
    })();

    return () => {
      cancelled = true;
      (async () => {
        try {
          if (windSoundRef.current) {
            await windSoundRef.current.stopAsync();
            await windSoundRef.current.unloadAsync();
          }
          if (unwindSoundRef.current) {
            await unwindSoundRef.current.stopAsync();
            await unwindSoundRef.current.unloadAsync();
          }
        } catch {
        } finally {
          windSoundRef.current = null;
          unwindSoundRef.current = null;
          audioLockRef.current = "none";
        }
      })();
    };
  }, []);

  // -------------------------------------------------------
  // SOUND HELPERS
  // -------------------------------------------------------
  const hardStopAllAudio = () => {
    (async () => {
      try {
        if (windSoundRef.current) await windSoundRef.current.stopAsync();
        if (unwindSoundRef.current) await unwindSoundRef.current.stopAsync();
      } catch {
      } finally {
        audioLockRef.current = "none";
      }
    })();
  };

  const startWind = () => {
    if (!soundOn) return;
    const snd = windSoundRef.current;
    if (!snd) return;

    const playId = ++windPlayIdRef.current;
    audioLockRef.current = "wind";

    (async () => {
      try {
        if (unwindSoundRef.current) {
          try {
            await unwindSoundRef.current.stopAsync();
          } catch {}
        }

        if (audioLockRef.current !== "wind" || windPlayIdRef.current !== playId)
          return;

        await snd.setIsLoopingAsync(true);

        if (audioLockRef.current !== "wind" || windPlayIdRef.current !== playId)
          return;

        await snd.playAsync();
      } catch {
        // ignore
      }
    })();
  };

  const stopWind = () => {
    const snd = windSoundRef.current;
    if (!snd) {
      if (audioLockRef.current === "wind") audioLockRef.current = "none";
      return;
    }

    (async () => {
      try {
        await snd.stopAsync();
      } catch {
      } finally {
        if (audioLockRef.current === "wind") {
          audioLockRef.current = "none";
        }
      }
    })();
  };

  const startUnwindSound = () => {
    if (!soundOn) return;
    const snd = unwindSoundRef.current;
    if (!snd) return;

    const playId = ++unwindPlayIdRef.current;
    audioLockRef.current = "unwind";

    (async () => {
      try {
        if (windSoundRef.current) {
          try {
            await windSoundRef.current.stopAsync();
          } catch {}
        }

        if (
          audioLockRef.current !== "unwind" ||
          unwindPlayIdRef.current !== playId
        ) {
          return;
        }

        await snd.setIsLoopingAsync(false);

        if (
          audioLockRef.current !== "unwind" ||
          unwindPlayIdRef.current !== playId
        ) {
          return;
        }

        // Use replayAsync instead of manual seek to reduce "Seeking interrupted" spam
        await snd.replayAsync();
      } catch {
        // ignore
      }
    })();
  };

  const stopUnwindSound = () => {
    const snd = unwindSoundRef.current;
    if (!snd) {
      if (audioLockRef.current === "unwind") audioLockRef.current = "none";
      return;
    }

    (async () => {
      try {
        await snd.stopAsync();
      } catch {
      } finally {
        if (audioLockRef.current === "unwind") {
          audioLockRef.current = "none";
        }
      }
    })();
  };

  const stopAllGearSounds = () => {
    isUnwindingRef.current = false;
    hardStopAllAudio();
  };

  // -------------------------------------------------------
  // LAYOUT + INTERLOCK ENGINE
  // -------------------------------------------------------
  const GOLD_RADIUS = SIZES.GOLD / 2;

  const CENTER_X = W / 2;
  const CENTER_Y = H * 0.68;

  const gearLayout: GearConfig[] = useMemo(() => {
    const gears: InternalGear[] = [];
    const parents: number[] = [];

    gears.push({
      id: "gold",
      src: IMG.gold,
      cx: CENTER_X,
      cy: CENTER_Y,
      r: GOLD_RADIUS,
      dir: 1,
      speed: 1,
    });
    parents.push(-1);

    const TOTAL_GEARS = 30;

    const pickSize = (i: number) => {
      if (i < 7) return Math.random() < 0.6 ? SIZES.M : SIZES.L;
      return SIZES.S;
    };

    const pickSrc = (r: number) => {
      if (Math.abs(r - SIZES.L / 2) < 1 || Math.abs(r - SIZES.M / 2) < 1) {
        return GEAR_POOL_MED[Math.floor(Math.random() * GEAR_POOL_MED.length)];
      }
      return GEAR_POOL_SMALL[Math.floor(Math.random() * GEAR_POOL_SMALL.length)];
    };

    for (let i = 1; i < TOTAL_GEARS; i++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 32) {
        attempts++;

        const parentIndex = Math.floor(Math.random() * gears.length);
        const parent = gears[parentIndex];
        const size = pickSize(i);
        const r = size / 2;

        const angle = Math.random() * Math.PI * 2;
        const targetDist = parent.r + r;

        const cx = parent.cx + Math.cos(angle) * (targetDist - 1);
        const cy = parent.cy + Math.sin(angle) * (targetDist - 1);

        if (
          cx - r < -40 ||
          cx + r > W + 40 ||
          cy + r > H + 35 ||
          cy - r < H * 0.16
        ) {
          continue;
        }

        let valid = true;
        for (let j = 0; j < gears.length; j++) {
          if (j === parentIndex) continue;
          const g = gears[j];
          const dx = cx - g.cx;
          const dy = cy - g.cy;
          const dist = Math.hypot(dx, dy);
          const minGap = g.r + r;

          if (dist < minGap * 1.1) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;

        gears.push({
          id: `gear-${i}-${Math.random().toString(36).slice(2)}`,
          src: pickSrc(r),
          cx,
          cy,
          r,
          dir: 0,
          speed: 0,
        });
        parents.push(parentIndex);
        placed = true;
      }
    }

    const n = gears.length;
    const neighbors = Array.from({ length: n }, () => [] as number[]);

    for (let i = 1; i < n; i++) {
      const p = parents[i];
      if (p >= 0) {
        neighbors[i].push(p);
        neighbors[p].push(i);
      }
    }

    const queue = [0];
    gears[0].dir = 1;
    gears[0].speed = 1;

    while (queue.length > 0) {
      const idx = queue.shift()!;
      const g = gears[idx];

      for (const ni of neighbors[idx]) {
        const ng = gears[ni];
        if (ng.dir !== 0) continue;
        ng.dir = -g.dir;
        ng.speed = g.speed * (g.r / ng.r);
        queue.push(ni);
      }
    }

    return gears.map((g) => ({
      id: g.id,
      src: g.src,
      x: g.cx - g.r,
      y: g.cy - g.r,
      size: g.r * 2,
      dir: g.dir,
      speed: g.speed,
      isGold: g.id === "gold",
    }));
  }, []);

  // -------------------------------------------------------
  // POWER CALC
  // -------------------------------------------------------
  const updatePowerFromEnergy = () => {
    const newPower = Math.round(energyRef.current / 8);
    if (newPower !== powerRef.current) {
      powerRef.current = newPower;
      setPower(newPower);
    }
  };

  // -------------------------------------------------------
  // RESET
  // -------------------------------------------------------
  const reset = () => {
    goldAngle.value = 0;
    energyRef.current = 0;
    powerRef.current = 0;
    setPower(0);

    isUnwindingRef.current = false;
    unwindStartEnergyRef.current = 0;
    unwindDurationRef.current = 0;
    unwindElapsedRef.current = 0;

    stopAllGearSounds();
  };

  // -------------------------------------------------------
  // PANRESPONDER
  // -------------------------------------------------------
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,

        onPanResponderGrant: (_, g) => {
          const dx = g.x0 - CENTER_X;
          const dy = g.y0 - CENTER_Y;
          const dist = Math.hypot(dx, dy);

          if (dist <= GOLD_RADIUS * 1.15) {
            draggingRef.current = true;
            hadGoldTouchRef.current = true;
            prevAngleRef.current = Math.atan2(dy, dx);

            isUnwindingRef.current = false;
            stopUnwindSound();

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {}
            );
          } else {
            draggingRef.current = false;
            hadGoldTouchRef.current = false;
            prevAngleRef.current = null;
          }
        },

        onPanResponderMove: (_, g) => {
          if (!draggingRef.current || prevAngleRef.current == null) {
            stopWind();
            return;
          }

          const dx = g.moveX - CENTER_X;
          const dy = g.moveY - CENTER_Y;
          const dist = Math.hypot(dx, dy);

          // ---- SLIDE-OFF DETECTION ----
          if (dist > GOLD_RADIUS * 1.3) {
            // Treat as a RELEASE, but keep energy (no reset)
            draggingRef.current = false;
            hadGoldTouchRef.current = false;
            prevAngleRef.current = null;

            if (pauseTimerRef.current) {
              clearTimeout(pauseTimerRef.current);
              pauseTimerRef.current = null;
            }

            stopWind();

            if (energyRef.current > 10 && !isUnwindingRef.current) {
              const startE = energyRef.current;
              isUnwindingRef.current = true;
              unwindStartEnergyRef.current = startE;
              unwindElapsedRef.current = 0;

              const MIN_UNWIND_MS = 700;
              const MAX_UNWIND_MS = 6500;
              const MAX_ENERGY_FOR_DURATION = 240000;

              const clamped = Math.min(MAX_ENERGY_FOR_DURATION, startE);
              const ratio =
                MAX_ENERGY_FOR_DURATION > 0
                  ? clamped / MAX_ENERGY_FOR_DURATION
                  : 0;

              unwindDurationRef.current =
                MIN_UNWIND_MS +
                (MAX_UNWIND_MS - MIN_UNWIND_MS) * ratio;

              startUnwindSound();
            }

            return;
          }

          // ---- NORMAL DRAG LOGIC (still on gear) ----
          const ang = Math.atan2(dy, dx);

          let delta = ang - prevAngleRef.current;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;

          const deg = (delta * 180) / Math.PI;
          const absDeg = Math.abs(deg);

          lastMoveTimeRef.current = Date.now();

          if (absDeg >= MIN_MOVE_TO_START) {
            if (audioLockRef.current !== "unwind") {
              startWind();
            }

            if (pauseTimerRef.current) {
              clearTimeout(pauseTimerRef.current);
              pauseTimerRef.current = null;
            }
          } else {
            if (!pauseTimerRef.current) {
              pauseTimerRef.current = setTimeout(() => {
                if (
                  Date.now() - lastMoveTimeRef.current >=
                  PAUSE_STABILIZE_MS
                ) {
                  stopWind();
                }
                pauseTimerRef.current = null;
              }, PAUSE_STABILIZE_MS);
            }
          }

          goldAngle.value += deg;

          const ENERGY_GAIN = 14;
          energyRef.current += absDeg * ENERGY_GAIN;
          updatePowerFromEnergy();

          prevAngleRef.current = ang;
        },

        onPanResponderRelease: () => {
          draggingRef.current = false;
          hadGoldTouchRef.current = false;
          prevAngleRef.current = null;

          if (pauseTimerRef.current) {
            clearTimeout(pauseTimerRef.current);
            pauseTimerRef.current = null;
          }

          stopWind();

          if (isUnwindingRef.current) {
            // Already configured by slide-off; don't reconfigure duration.
          } else if (energyRef.current > 10) {
            const startE = energyRef.current;
            isUnwindingRef.current = true;
            unwindStartEnergyRef.current = startE;
            unwindElapsedRef.current = 0;

            const MIN_UNWIND_MS = 700;
            const MAX_UNWIND_MS = 6500;
            const MAX_ENERGY_FOR_DURATION = 240000;

            const clamped = Math.min(MAX_ENERGY_FOR_DURATION, startE);
            const ratio =
              MAX_ENERGY_FOR_DURATION > 0
                ? clamped / MAX_ENERGY_FOR_DURATION
                : 0;

            unwindDurationRef.current =
              MIN_UNWIND_MS +
              (MAX_UNWIND_MS - MIN_UNWIND_MS) * ratio;

            startUnwindSound();
          } else {
            stopAllGearSounds();
          }

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {}
          );
        },

        onPanResponderTerminationRequest: () => false,

        onPanResponderTerminate: () => {
          draggingRef.current = false;
          hadGoldTouchRef.current = false;
          prevAngleRef.current = null;

          if (pauseTimerRef.current) {
            clearTimeout(pauseTimerRef.current);
            pauseTimerRef.current = null;
          }

          stopAllGearSounds();
        },
      }),
    [soundOn]
  );

  // -------------------------------------------------------
  // UNWIND ENGINE
  // -------------------------------------------------------
  useEffect(() => {
    const BASE_ROT = 0.06;
    let lastTime = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;

      if (isUnwindingRef.current && energyRef.current > 0) {
        const startE = unwindStartEnergyRef.current;
        const dur = unwindDurationRef.current;

        if (startE <= 0 || dur <= 0) {
          energyRef.current = 0;
          isUnwindingRef.current = false;
          stopUnwindSound();
          updatePowerFromEnergy();
          return;
        }

        unwindElapsedRef.current += dt;
        const progress = Math.min(1, unwindElapsedRef.current / dur);

        const currentE = startE * (1 - progress);
        energyRef.current = currentE;

        const rotationStep = currentE * BASE_ROT * (dt / 16);
        goldAngle.value += rotationStep;

        updatePowerFromEnergy();

        if (progress >= 1 || currentE <= 0.1) {
          energyRef.current = 0;
          isUnwindingRef.current = false;
          unwindElapsedRef.current = 0;
          stopUnwindSound();
          updatePowerFromEnergy();
        }
      } else {
        if (
          audioLockRef.current === "unwind" &&
          energyRef.current <= 0.1
        ) {
          stopUnwindSound();
        }
      }
    }, 16);

    return () => clearInterval(interval);
  }, []);

  // -------------------------------------------------------
  // SAFETY WATCHDOG
  // -------------------------------------------------------
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (
        !draggingRef.current &&
        !isUnwindingRef.current &&
        audioLockRef.current === "wind"
      ) {
        stopWind();
      }

      if (
        !isUnwindingRef.current &&
        audioLockRef.current === "unwind" &&
        energyRef.current <= 0.1
      ) {
        stopUnwindSound();
      }
    }, 250);

    return () => clearInterval(watchdog);
  }, []);

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <FullscreenWrapper>
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* HEADER – mirrored from Spinner (headerRow) */}
        <View style={styles.headerRow}>
          <BackButton />
          <Ionicons
            name="settings-sharp"
            size={26}
            color={BRAND.silver}
            onPress={() => setSettingsVisible(true)}
          />
        </View>

        {/* POWER */}
        <View style={styles.powerWrap}>
          <Animated.Text style={styles.powerLabel}>POWER</Animated.Text>
          <Animated.Text style={styles.powerValue}>{power}</Animated.Text>
        </View>

        {/* GEARS */}
        {gearLayout.map((gear) => (
          <GearItem key={gear.id} gear={gear} goldAngle={goldAngle} />
        ))}

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

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // gears background stays darker than spinner
  },
  gear: {
    position: "absolute",
  },
  headerRow: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  powerWrap: {
    position: "absolute",
    top: 96,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9,
  },
  powerLabel: {
    color: BRAND.gold,
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
