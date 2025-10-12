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
  Text,
  View,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import BackButton from "../../components/BackButton";
import FullscreenWrapper from "../../components/FullscreenWrapper"; // ✅ hides status bar globally

import {
  balloonImages,
  cloudImages,
  popSounds,
  slashSounds,
  type BalloonColor,
} from "../../assets";
import { rand, pick } from "../../utils/random";

// ---------- Types ----------
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

// ---------- Constants ----------
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ---------- Component ----------
export default function BalloonPopper() {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [score, setScore] = useState<number>(0);

  const popSoundObjs = useRef<Audio.Sound[]>([]);
  const slashSoundObjs = useRef<Audio.Sound[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const nextBalloonAt = useRef<number>(0);
  const nextCloudAt = useRef<number>(0);

  const colors: BalloonColor[] = useMemo(
    () => ["blue", "green", "orange", "pink", "purple", "red", "yellow"],
    []
  );

  // ---------- Audio setup ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const pops = await Promise.all(
        popSounds.map((src: any) =>
          Audio.Sound.createAsync(src, { shouldPlay: false })
        )
      );
      const slashes = await Promise.all(
        slashSounds.map((src: any) =>
          Audio.Sound.createAsync(src, { shouldPlay: false })
        )
      );

      if (!mounted) {
        pops.forEach((r) => r.sound.unloadAsync());
        slashes.forEach((r) => r.sound.unloadAsync());
        return;
      }

      popSoundObjs.current = pops.map((r) => r.sound);
      slashSoundObjs.current = slashes.map((r) => r.sound);
    })();

    return () => {
      mounted = false;
      popSoundObjs.current.forEach((s) => s.unloadAsync());
      slashSoundObjs.current.forEach((s) => s.unloadAsync());
    };
  }, []);

  const playOne = useCallback(async (arr: Audio.Sound[]) => {
    if (arr.length === 0) return;
    const s = pick(arr);
    try {
      await s.setPositionAsync(0);
      const status = (await s.getStatusAsync()) as AVPlaybackStatus;
      if ("isLoaded" in status && status.isLoaded && status.isPlaying) {
        await s.stopAsync();
        await s.setPositionAsync(0);
      }
      await s.playAsync();
    } catch {}
  }, []);

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
    setClouds((prev) =>
      prev.length > 12 ? [...prev.slice(2), c] : [...prev, c]
    );
  }, []);

  // ---------- Main Loop ----------
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

      const now = performance.now();
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

  // ---------- Touch Handling ----------
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
            playOne(popSoundObjs.current);
            b.popped = true;

            Animated.timing(b.scale, {
              toValue: 0,
              duration: 120,
              useNativeDriver: true,
            }).start(() => {
              setBalloons((current) =>
                current.filter((item) => item.id !== b.id)
              );
            });
            return copy;
          }
        }
        playOne(slashSoundObjs.current);
        return copy;
      });
    },
    [playOne]
  );

  // ---------- Render ----------
  return (
    <FullscreenWrapper>
      <View style={styles.container}>
        {/* Background gradient */}
        <LinearGradient
          colors={["#0a1f5e", "#1b3e9b", "#78b7ff"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        {/* Header (Back + Score) */}
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.score}>Score: {score}</Text>
          <View style={{ width: 50 }} />
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
      </View>
    </FullscreenWrapper>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute",
    top: 40,
    left: 15,
    right: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10, // ✅ keeps BackButton functional
  },
  cloud: {
    position: "absolute",
    width: 220,
    height: 140,
    opacity: 0.9,
  },
  balloon: { position: "absolute" },
  score: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
