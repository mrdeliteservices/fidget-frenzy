// app/screens/balloon-popper.tsx – v0.9-dev unified
// ✅ Reliable hit testing (page coords -> local coords)
// ✅ Forgiving tap hitbox
// ✅ Continuous swipe/drag pops balloons (tap is king)
// ✅ NO slash sound (removed entirely)
// ✅ Pop sound throttled to prevent “catch up” audio spam
// ✅ More balloons (spawn faster + sane on-screen cap)
// ✅ Option A: bottom “grace zone” so you can’t camp the entry line
// ✅ B2: Pop Puff (expanding + fading ring at pop location)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  GestureResponderEvent,
  Image,
  Pressable,
  StyleSheet,
  View,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import BackButton from "../../components/BackButton";
import FullscreenWrapper from "../../components/FullscreenWrapper";
import SettingsModal from "../../components/SettingsModal";
import GameHeader from "../../components/GameHeader";
import { playSound, preloadSounds } from "../../lib/soundManager";

import {
  balloonImages,
  cloudImages,
  popSounds, // array of AV sources
  type BalloonColor,
} from "../../assets";
import { rand, pick } from "../../utils/random";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Balloon = {
  id: string;
  color: BalloonColor;
  x: number;
  y: number;
  size: number;
  speed: number;
  popped: boolean;
  scale: Animated.Value;
};

type Cloud = {
  id: string;
  imgIndex: number;
  x: number;
  y: number;
  scale: number;
  speed: number;
};

// B2 Pop Puff
type Puff = {
  id: string;
  x: number;
  y: number;
  size: number;
  scale: Animated.Value;
  opacity: Animated.Value;
};

// Feel knobs
const HIT_PAD = 18; // forgiving tap radius (12–24)
const SWIPE_RADIUS = 34; // swipe pops within this radius (26–44)

// ✅ Option A: Bottom grace zone (balloon must rise into playfield before it can be popped)
// This prevents “camping” the bottom edge and popping on entry.
const POP_GRACE_PX = 90; // 70–130 is the sweet spot

// Sound control
const POP_SOUND_COOLDOWN_MS = 90; // 70–120; lower = more sound, higher = calmer

// Spawn control
const MAX_BALLOONS_ONSCREEN = 28; // 18–30; higher makes it more “arcade”
const BALLOON_SPAWN_MIN_MS = 160;
const BALLOON_SPAWN_MAX_MS = 300;

// Puff control (performance safety)
const MAX_PUFFS = 26;
const PUFF_MS = 220;

export default function BalloonPopper() {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [puffs, setPuffs] = useState<Puff[]>([]);
  const [score, setScore] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const nextBalloonAt = useRef(0);
  const nextCloudAt = useRef(0);

  // Playfield offset (page coords -> local coords)
  const playfieldRef = useRef<View | null>(null);
  const playfieldOffsetRef = useRef({ x: 0, y: 0 });

  // Pop sound throttle
  const lastPopSoundAtRef = useRef(0);

  const colors: BalloonColor[] = useMemo(
    () => ["blue", "green", "orange", "pink", "purple", "red", "yellow"],
    []
  );

  // ---------- Preload sounds ----------
  useEffect(() => {
    const makeMap = (arr: any[], key: string) =>
      Object.fromEntries(arr.map((src, i) => [`${key}${i}`, src]));
    preloadSounds({
      ...makeMap(popSounds as any[], "pop"),
    });
  }, []);

  const playRandomFrom = useCallback(
    async (arr: any[], key: string) => {
      if (!soundOn || !arr || arr.length === 0) return;
      const idx = Math.floor(Math.random() * arr.length);
      // Fire-and-forget; do not await during rapid pops
      playSound(`${key}${idx}`, arr[idx]).catch(() => {});
    },
    [soundOn]
  );

  const playPop = useCallback(() => {
    const now = Date.now();
    if (now - lastPopSoundAtRef.current < POP_SOUND_COOLDOWN_MS) return;
    lastPopSoundAtRef.current = now;
    playRandomFrom(popSounds as any[], "pop");
  }, [playRandomFrom]);

  // ---------- B2 Pop Puff ----------
  const addPuff = useCallback((x: number, y: number, balloonSize: number) => {
    const id = makeId();

    // Puff size tuned to feel “bloomy” without being huge
    const base = Math.max(44, Math.min(120, balloonSize * 0.78));

    const puff: Puff = {
      id,
      x,
      y,
      size: base,
      scale: new Animated.Value(0.35),
      opacity: new Animated.Value(0.95),
    };

    setPuffs((prev) => {
      const next = [...prev, puff];
      return next.length > MAX_PUFFS ? next.slice(next.length - MAX_PUFFS) : next;
    });

    Animated.parallel([
      Animated.timing(puff.scale, {
        toValue: 1.25,
        duration: PUFF_MS,
        useNativeDriver: true,
      }),
      Animated.timing(puff.opacity, {
        toValue: 0,
        duration: PUFF_MS,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPuffs((current) => current.filter((p) => p.id !== id));
    });
  }, []);

  // ---------- Spawning ----------
  const spawnBalloon = useCallback(() => {
    if (balloons.length >= MAX_BALLOONS_ONSCREEN) return;

    const color = pick(colors);
    const size = rand(58, 110);
    const half = size / 2;
    const x = rand(half + 6, SCREEN_W - half - 6);

    // Start below screen so entry feels natural
    const y = SCREEN_H + half + 8;

    const speed = rand(1.2, 2.8);
    const b: Balloon = {
      id: makeId(),
      color,
      x,
      y,
      size,
      speed,
      popped: false,
      scale: new Animated.Value(1),
    };

    setBalloons((prev) =>
      prev.length > 60 ? [...prev.slice(10), b] : [...prev, b]
    );
  }, [balloons.length, colors]);

  const spawnCloud = useCallback(() => {
    const imgIndex = Math.floor(rand(0, cloudImages.length));
    const scale = rand(0.7, 1.8);
    const height = 80 * scale;
    const y = rand(20, SCREEN_H * 0.7 - height);
    const speed = rand(0.3, 0.8) * (2.2 - scale);

    const c: Cloud = {
      id: makeId(),
      imgIndex,
      x: -200 * scale,
      y,
      scale,
      speed,
    };

    setClouds((prev) => (prev.length > 12 ? [...prev.slice(2), c] : [...prev, c]));
  }, []);

  // ---------- Pop helper (tap + swipe) ----------
  const popBalloonById = useCallback(
    (id: string) => {
      setBalloons((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((b) => b.id === id);
        if (idx === -1) return prev;

        const b = copy[idx];
        if (b.popped) return prev;

        // B2 Puff at the moment of pop (use current balloon center)
        addPuff(b.x, b.y, b.size);

        b.popped = true;
        setScore((s) => s + 1);
        playPop();

        Animated.timing(b.scale, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }).start(() => {
          setBalloons((current) => current.filter((item) => item.id !== id));
        });

        return copy;
      });
    },
    [addPuff, playPop]
  );

  // ---------- Hit test ----------
  const hitTestAt = useCallback(
    (x: number, y: number, radiusPad: number) => {
      // grace line: balloon must rise enough before it can be popped
      const graceLineY = SCREEN_H - POP_GRACE_PX;

      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        if (b.popped) continue;

        // ✅ Option A: do NOT allow popping while balloon is still in the grace zone
        // Use balloon "top" to decide when it's entered playfield enough.
        const topOfBalloon = b.y - b.size / 2;
        if (topOfBalloon > graceLineY) continue;

        const dx = x - b.x;
        const dy = y - b.y;
        const r = b.size / 2 + radiusPad;

        if (dx * dx + dy * dy <= r * r) return b.id;
      }
      return null;
    },
    [balloons]
  );

  // ---------- Main loop ----------
  useEffect(() => {
    const loop = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / (1000 / 60), 2.5);
      lastTsRef.current = ts;

      setBalloons((prev) =>
        prev
          .map((b) => ({ ...b, y: b.y - b.speed * (dt * 1.2) }))
          .filter((b) => !b.popped && b.y + b.size / 2 >= -10)
      );

      setClouds((prev) =>
        prev
          .map((c) => ({ ...c, x: c.x + c.speed * (dt * 1.2) }))
          .filter((c) => c.x <= SCREEN_W + 240 * c.scale)
      );

      const now = ts;
      if (now >= nextBalloonAt.current) {
        spawnBalloon();
        nextBalloonAt.current = now + rand(BALLOON_SPAWN_MIN_MS, BALLOON_SPAWN_MAX_MS);
      }
      if (now >= nextCloudAt.current) {
        spawnCloud();
        nextCloudAt.current = now + rand(1600, 2600);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = 0;
    };
  }, [spawnBalloon, spawnCloud]);

  // ---------- Tap ----------
  const handleTap = useCallback(
    (e: GestureResponderEvent) => {
      const { pageX, pageY } = e.nativeEvent;
      const off = playfieldOffsetRef.current;
      const x = pageX - off.x;
      const y = pageY - off.y;

      const hitId = hitTestAt(x, y, HIT_PAD);
      if (hitId) popBalloonById(hitId);
    },
    [hitTestAt, popBalloonById]
  );

  // ---------- Swipe/Drag popping (tap is king) ----------
  const swipeGesture = useMemo(() => {
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(2) // keeps “rest finger and swirl” behavior
      .onUpdate((ev) => {
        const off = playfieldOffsetRef.current;
        const x = ev.absoluteX - off.x;
        const y = ev.absoluteY - off.y;

        const hitId = hitTestAt(x, y, SWIPE_RADIUS);
        if (hitId) popBalloonById(hitId);
      });
  }, [hitTestAt, popBalloonById]);

  // ---------- Reset ----------
  const reset = () => {
    setScore(0);
    setBalloons([]);
    setClouds([]);
    setPuffs([]);
  };

  return (
    <FullscreenWrapper>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <LinearGradient
            colors={["#0a1f5e", "#1b3e9b", "#78b7ff"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          <View style={styles.headerWrap} pointerEvents="box-none">
            <GameHeader
              left={<BackButton />}
              centerLabel="Score:"
              centerValue={score}
              onPressSettings={() => setSettingsOpen(true)}
            />
          </View>

          {clouds.map((c) => {
            const src: any = cloudImages[c.imgIndex];
            return (
              <Image
                key={c.id}
                source={src}
                style={[
                  styles.cloud,
                  { left: c.x, top: c.y, transform: [{ scale: c.scale }] },
                ]}
                resizeMode="contain"
              />
            );
          })}

          <View
            ref={(n) => {
              playfieldRef.current = n;
            }}
            style={StyleSheet.absoluteFill}
            onLayout={() => {
              playfieldRef.current?.measureInWindow((x, y) => {
                playfieldOffsetRef.current = { x, y };
              });
            }}
          >
            <GestureDetector gesture={swipeGesture}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPressIn={handleTap}
                android_disableSound={true}
              >
                {/* B2: Pop Puff overlay (non-interactive) */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {puffs.map((p) => {
                    const left = p.x - p.size / 2;
                    const top = p.y - p.size / 2;
                    return (
                      <Animated.View
                        key={p.id}
                        style={[
                          styles.puff,
                          {
                            width: p.size,
                            height: p.size,
                            left,
                            top,
                            opacity: p.opacity,
                            transform: [{ scale: p.scale }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                {balloons.map((b) => {
                  const src: any = balloonImages[b.color];
                  const left = b.x - b.size / 2;
                  const top = b.y - b.size / 2;
                  return (
                    <Animated.Image
                      key={b.id}
                      source={src}
                      style={[
                        styles.balloon,
                        {
                          width: b.size,
                          height: b.size,
                          left,
                          top,
                          transform: [{ scale: b.scale }],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  );
                })}
              </Pressable>
            </GestureDetector>
          </View>

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
  safe: { flex: 1 },

  headerWrap: {
    position: "absolute",
    top: 65,
    left: 0,
    right: 0,
    zIndex: 20,
  },

  cloud: {
    position: "absolute",
    width: 220,
    height: 140,
    opacity: 0.9,
  },
  balloon: { position: "absolute" },

  // B2 Puff ring (simple + lightweight)
  puff: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
  },
});
