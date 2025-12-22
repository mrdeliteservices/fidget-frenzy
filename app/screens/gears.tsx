// app/screens/gears.tsx
// Fidget Frenzy — Gears (v0.9-dev)
// ✅ Header standardized via GameHeader (Back + Power + Settings)
// ✅ Wind/unwind preserved (NO modulo/clamp; extrapolate extend)
// ✅ Only winding/unwinding audio (no click)
// ✅ Random gear network each mount + reset (safe layout, meshes correctly)
// ✅ More top density: repeat small gears + stronger upward placement bias
// ✅ Phase 2: Prevent multi-contact (single authority parent per follower)
// ✅ UI PASS: Stage backlight/glow to fix dark-on-dark visibility (no physics changes)
// ✅ FIX: Stop winding loop when drag motion pauses (prevents “sound continues” bug)
// ✅ Stage standardized via PremiumStage (Gears keeps shine ON)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  GestureResponderEvent,
  SafeAreaView,
  ImageSourcePropType,
} from "react-native";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import GameHeader from "../../components/GameHeader";
import PremiumStage from "../../components/PremiumStage";

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

export default function Gears() {
  const spin = useRef(new Animated.Value(0)).current;

  const [mode, setMode] = useState<Mode>("idle");
  const modeRef = useRef<Mode>("idle");
  const [direction, setDirection] = useState<1 | -1>(1);

  // Power = how many turns away from rest (live)
  const [power, setPower] = useState(0);
  const restSpinRef = useRef(0);

  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const setModeNow = useCallback((next: Mode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  // ---------------- Rotation helper (single definition) ----------------
  const rotateForMultiplier = useCallback(
    (baseMult: number) => {
      const mSigned = baseMult * direction;
      const mAbs = Math.abs(mSigned);

      const value = Animated.multiply(spin, mAbs);
      const outputRange = mSigned >= 0 ? ["0deg", "360deg"] : ["0deg", "-360deg"];

      return value.interpolate({
        inputRange: [0, 1],
        outputRange,
        extrapolate: "extend",
      });
    },
    [direction, spin]
  );

  const rotateDriver = useMemo(() => rotateForMultiplier(1), [rotateForMultiplier]);

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

  // ---- Animation controls ----
  const stopNative = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  const pause = useCallback(() => {
    stopNative();
    spin.stopAnimation((v) => {
      if (Number.isFinite(v)) spin.setValue(v);
    });
  }, [spin, stopNative]);

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
    spin.setValue(0);
    restSpinRef.current = 0;
    setPower(0);
    setModeNow("idle");

    return () => {
      cancelled = true;

      stopNative();
      spin.stopAnimation();

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
  }, [setModeNow, spin, stopNative]);

  // ---- Live Power meter from spin value ----
  useEffect(() => {
    let raf = 0;
    let last = -1;

    const id = spin.addListener(({ value }) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;

        const turnsAway = Math.abs(value - restSpinRef.current);
        const p = Math.min(9999, Math.round(turnsAway * 10)); // tenths of a turn

        if (p !== last) {
          last = p;
          setPower(p);
        }
      });
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      spin.removeListener(id);
    };
  }, [spin]);

  // ---------------- Stage measurement ----------------
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Center/bottom with slight left bias (right-handed use)
  const DRIVER_LEFT_BIAS_PX = -40;
  const DRIVER_BOTTOM_PAD_PX = 220;

  const driverCenterX = stageSize.w > 0 ? stageSize.w / 2 + DRIVER_LEFT_BIAS_PX : 0;
  const driverCenterY = stageSize.h > 0 ? stageSize.h - DRIVER_BOTTOM_PAD_PX : 0;

  // ---------------- Assets ----------------
  const DRIVER_SOURCE = useMemo(() => require("../../assets/gears/gear_gold_large.png"), []);

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

  const DRIVER_SIZE = 260;

  // ---------------- Helpers ----------------
  const randomIn = (min: number, max: number) => min + Math.random() * (max - min);

  const dist = (x1: number, y1: number, x2: number, y2: number) =>
    Math.hypot(x1 - x2, y1 - y2);

  const pickFollowerSize = (tier: GearAsset["tier"]) => {
    if (tier === "large") return Math.round(randomIn(175, 205));
    if (tier === "medium") return Math.round(randomIn(130, 160));
    return Math.round(randomIn(90, 120));
  };

  // ---------------- Wind/unwind feel knobs ----------------
  const WIND_SENSITIVITY = 1.0;

  const UNWIND_MS_PER_TURN = 220;
  const UNWIND_MIN_MS = 260;
  const UNWIND_MAX_MS = 30000;

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // ✅ Drag idle stop: if finger is down but not moving, stop winding loop
  const DRAG_IDLE_STOP_MS = 200;

  // ---------------- Responder (touch wrapper does NOT rotate) ----------------
  const touchRef = useRef({
    active: false,
    moved: false,
    longPressFired: false,
    startPageX: 0,
    startPageY: 0,
    lastAngle: 0,

    restSpin: 0,
    startSpin: 0,
    totalTurns: 0,

    longPressTimer: null as ReturnType<typeof setTimeout> | null,
    idleStopTimer: null as ReturnType<typeof setTimeout> | null,
  });

  const MOVE_THRESHOLD = 18;
  const LONG_PRESS_MS = 450;

  const angleFromEvent = useCallback((evt: GestureResponderEvent) => {
    const ne = evt.nativeEvent;
    const x = ne.locationX ?? DRIVER_SIZE / 2;
    const y = ne.locationY ?? DRIVER_SIZE / 2;
    return Math.atan2(y - DRIVER_SIZE / 2, x - DRIVER_SIZE / 2);
  }, []);

  const normalizeDelta = (delta: number) => {
    const PI2 = Math.PI * 2;
    let d = delta % PI2;
    if (d > Math.PI) d -= PI2;
    if (d < -Math.PI) d += PI2;
    return d;
  };

  const reverseNow = useCallback(() => {
    if (modeRef.current === "dragging" || modeRef.current === "unwinding") return;
    setDirection((prev) => (prev === 1 ? -1 : 1));
  }, []);

  const unwindToRest = useCallback(
    (restValue: number) => {
      stopNative();

      spin.stopAnimation((current) => {
        const from = Number.isFinite(current) ? current : restValue;
        const turnsAway = Math.abs(from - restValue);

        const duration = clamp(
          turnsAway * UNWIND_MS_PER_TURN,
          UNWIND_MIN_MS,
          UNWIND_MAX_MS
        );

        const a = Animated.timing(spin, {
          toValue: restValue,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });

        animRef.current = a;

        a.start(({ finished }) => {
          if (!finished) return;
          setModeNow("idle");
          void safeStop("unwinding");
        });
      });
    },
    [UNWIND_MAX_MS, UNWIND_MIN_MS, UNWIND_MS_PER_TURN, safeStop, setModeNow, spin, stopNative]
  );

  const onGoldGrant = useCallback(
    (evt: GestureResponderEvent) => {
      if (modeRef.current === "unwinding") return;

      touchRef.current.active = true;
      touchRef.current.moved = false;
      touchRef.current.longPressFired = false;

      if (touchRef.current.idleStopTimer) {
        clearTimeout(touchRef.current.idleStopTimer);
        touchRef.current.idleStopTimer = null;
      }

      touchRef.current.startPageX = evt.nativeEvent.pageX ?? 0;
      touchRef.current.startPageY = evt.nativeEvent.pageY ?? 0;

      const a0 = angleFromEvent(evt);
      touchRef.current.lastAngle = a0;

      spin.stopAnimation((v) => {
        const s = Number.isFinite(v) ? v : 0;
        touchRef.current.restSpin = s;
        restSpinRef.current = s;
        touchRef.current.startSpin = s;
        touchRef.current.totalTurns = 0;
      });

      if (touchRef.current.longPressTimer) {
        clearTimeout(touchRef.current.longPressTimer);
      }

      touchRef.current.longPressTimer = setTimeout(() => {
        if (!touchRef.current.active) return;
        if (touchRef.current.moved) return;
        touchRef.current.longPressFired = true;

        void safeStop("winding");
        void safeStop("unwinding");

        reverseNow();
      }, LONG_PRESS_MS);
    },
    [angleFromEvent, reverseNow, safeStop, spin]
  );

  const onGoldMove = useCallback(
    (evt: GestureResponderEvent) => {
      if (!touchRef.current.active) return;

      const px = evt.nativeEvent.pageX ?? 0;
      const py = evt.nativeEvent.pageY ?? 0;

      const dx = px - touchRef.current.startPageX;
      const dy = py - touchRef.current.startPageY;

      if (!touchRef.current.moved) {
        if (Math.abs(dx) + Math.abs(dy) < MOVE_THRESHOLD) return;

        touchRef.current.moved = true;

        if (touchRef.current.longPressTimer) {
          clearTimeout(touchRef.current.longPressTimer);
          touchRef.current.longPressTimer = null;
        }

        pause();
        setModeNow("dragging");

        void safeStop("unwinding");
        void safeStartLoop("winding");

        spin.stopAnimation((v) => {
          touchRef.current.startSpin = Number.isFinite(v) ? v : 0;
          touchRef.current.totalTurns = 0;
        });

        const a = angleFromEvent(evt);
        touchRef.current.lastAngle = a;
      }

      if (touchRef.current.longPressFired) return;

      void safeStartLoop("winding");

      if (touchRef.current.idleStopTimer) clearTimeout(touchRef.current.idleStopTimer);
      touchRef.current.idleStopTimer = setTimeout(() => {
        if (!touchRef.current.active) return;
        if (modeRef.current !== "dragging") return;
        if (touchRef.current.longPressFired) return;
        void safeStop("winding");
      }, DRAG_IDLE_STOP_MS);

      const a = angleFromEvent(evt);

      const dA = normalizeDelta(a - touchRef.current.lastAngle);
      touchRef.current.lastAngle = a;

      const dTurns = (dA / (Math.PI * 2)) * WIND_SENSITIVITY;
      touchRef.current.totalTurns += dTurns;

      const dirMul = direction === 1 ? 1 : -1;
      spin.setValue(touchRef.current.startSpin + touchRef.current.totalTurns * dirMul);
    },
    [
      DRAG_IDLE_STOP_MS,
      WIND_SENSITIVITY,
      angleFromEvent,
      direction,
      pause,
      safeStartLoop,
      safeStop,
      setModeNow,
      spin,
    ]
  );

  const onGoldRelease = useCallback(() => {
    if (!touchRef.current.active) return;

    touchRef.current.active = false;

    if (touchRef.current.longPressTimer) {
      clearTimeout(touchRef.current.longPressTimer);
      touchRef.current.longPressTimer = null;
    }

    if (touchRef.current.idleStopTimer) {
      clearTimeout(touchRef.current.idleStopTimer);
      touchRef.current.idleStopTimer = null;
    }

    if (touchRef.current.longPressFired) {
      void safeStop("winding");
      void safeStop("unwinding");
      setModeNow("idle");
      return;
    }

    if (!touchRef.current.moved) {
      void safeStop("winding");
      void safeStop("unwinding");
      return;
    }

    setModeNow("unwinding");

    void safeStop("winding");
    void safeStartLoop("unwinding");

    unwindToRest(touchRef.current.restSpin);
  }, [safeStartLoop, safeStop, setModeNow, unwindToRest]);

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

  const reset = useCallback(() => {
    void safeStop("winding");
    void safeStop("unwinding");
    stopNative();
    spin.stopAnimation();
    spin.setValue(0);
    restSpinRef.current = 0;
    setDirection(1);
    setModeNow("idle");
    setPower(0);

    if (touchRef.current.longPressTimer) {
      clearTimeout(touchRef.current.longPressTimer);
      touchRef.current.longPressTimer = null;
    }
    if (touchRef.current.idleStopTimer) {
      clearTimeout(touchRef.current.idleStopTimer);
      touchRef.current.idleStopTimer = null;
    }

    if (stageSize.w > 0 && stageSize.h > 0) {
      generateLayout(stageSize.w, stageSize.h);
    }
  }, [generateLayout, safeStop, setModeNow, spin, stageSize.h, stageSize.w, stopNative]);

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
              onPressSettings={() => setSettingsOpen(true)}
            />
          </View>

          {/* STAGE */}
          <View style={styles.stageWrap}>
            <PremiumStage
              showShine={false} // ✅ KILLS the top gray cap
              style={{ backgroundColor: "#161824" }} // keep your Gears stage tone
            >
              <View
                style={styles.stageInner}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setStageSize({ w: width, h: height });
                }}
              >
                {/* Stage backlight / glow (visual only) */}
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.00)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={styles.stageGlow} />

                {/* Followers (network) */}
                {placed.map((g) => {
                  const rotate = rotateForMultiplier(g.mult);
                  return (
                    <Animated.Image
                      key={g.id}
                      source={g.source}
                      resizeMode="contain"
                      style={[
                        styles.img,
                        {
                          width: g.size,
                          height: g.size,
                          left: g.left,
                          top: g.top,
                          transform: [{ rotate }],
                        },
                      ]}
                    />
                  );
                })}

                {/* DRIVER */}
                <View
                  style={[
                    styles.img,
                    {
                      width: DRIVER_SIZE,
                      height: DRIVER_SIZE,
                      left: driverCenterX - DRIVER_SIZE / 2,
                      top: driverCenterY - DRIVER_SIZE / 2,
                    },
                  ]}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={onGoldGrant}
                  onResponderMove={onGoldMove}
                  onResponderRelease={onGoldRelease}
                  onResponderTerminate={onGoldRelease}
                >
                  <Animated.View
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: [{ rotate: rotateDriver }],
                    }}
                  >
                    <Animated.Image
                      source={DRIVER_SOURCE}
                      resizeMode="contain"
                      style={{ width: "100%", height: "100%" }}
                    />
                  </Animated.View>
                </View>
              </View>
            </PremiumStage>
          </View>


          {/* Settings modal */}
          <SettingsModal
            visible={settingsOpen}
            onClose={() => setSettingsOpen(false)}
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

  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },

  // matches your other staged games’ outer spacing pattern
  stageWrap: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
  },

  // inner stage surface (keeps your previous sizing behavior)
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
