// app/screens/balloon-popper.tsx – v0.9-dev unified
// Adds SettingsModal + sound toggle + reset function
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import BackButton from "../../components/BackButton";
import FullscreenWrapper from "../../components/FullscreenWrapper";
import SettingsModal from "../../components/SettingsModal";
import GameHeader from "../../components/GameHeader";
import { playSound, preloadSounds } from "../../lib/soundManager";

import {
  balloonImages,
  cloudImages,
  popSounds, // array of AV sources
  slashSounds, // array of AV sources
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

export default function BalloonPopper() {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [score, setScore] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const nextBalloonAt = useRef(0);
  const nextCloudAt = useRef(0);

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
      ...makeMap(slashSounds as any[], "slash"),
    });
  }, []);

  const playRandomFrom = useCallback(
    async (arr: any[], key: string) => {
      if (!soundOn || !arr || arr.length === 0) return;
      const idx = Math.floor(Math.random() * arr.length);
      await playSound(`${key}${idx}`, arr[idx]);
    },
    [soundOn]
  );

  const playPop = useCallback(async () => {
    await playRandomFrom(popSounds as any[], "pop");
  }, [playRandomFrom]);

  const playSlash = useCallback(async () => {
    await playRandomFrom(slashSounds as any[], "slash");
  }, [playRandomFrom]);

  // ---------- Spawning ----------
  const spawnBalloon = useCallback(() => {
    const color = pick(colors);
    const size = rand(58, 110);
    const half = size / 2;
    const x = rand(half + 6, SCREEN_W - half - 6);
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
  }, [colors]);

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

      // ✅ Use RAF timestamp (always defined) instead of performance.now()
      const now = ts;

      if (now >= nextBalloonAt.current) {
        spawnBalloon();
        nextBalloonAt.current = now + rand(220, 400);
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

  // ---------- Touch handling ----------
  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      setBalloons((prev) => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
          const b = copy[i];
          const dx = x - b.x;
          const dy = y - b.y;
          const r = b.size / 2;
          if (dx * dx + dy * dy <= r * r) {
            setScore((s) => s + 1);
            playPop();
            b.popped = true;
            Animated.timing(b.scale, {
              toValue: 0,
              duration: 120,
              useNativeDriver: true,
            }).start(() => {
              setBalloons((current) => current.filter((item) => item.id !== b.id));
            });
            return copy;
          }
        }
        playSlash();
        return copy;
      });
    },
    [playPop, playSlash]
  );

  // ---------- Reset ----------
  const reset = () => {
    setScore(0);
    setBalloons([]);
    setClouds([]);
  };

  // ---------- Render ----------
  return (
    <FullscreenWrapper>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          {/* Background */}
          <LinearGradient
            colors={["#0a1f5e", "#1b3e9b", "#78b7ff"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          {/* HEADER: canonical GameHeader */}
          <View style={styles.headerWrap} pointerEvents="box-none">
            <GameHeader
              left={<BackButton />}
              centerLabel="Score:"
              centerValue={score}
              onPressSettings={() => setSettingsOpen(true)}
            />
          </View>

          {/* Clouds */}
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

          {/* Balloons */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handlePress}
            android_disableSound={true}
          >
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

// ---------- Styles ----------
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
});
