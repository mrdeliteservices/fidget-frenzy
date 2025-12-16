import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { Audio } from "expo-av";

type SoundKey = "click" | "winding" | "unwinding";

export default function Gears() {
  const spin = useRef(new Animated.Value(0)).current;

  const [isRunning, setIsRunning] = useState(true);
  const [direction, setDirection] = useState<1 | -1>(1);

  const isRunningRef = useRef(true);
  const isMountedRef = useRef(true);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // ---- Audio ----
  const soundsRef = useRef<Record<SoundKey, Audio.Sound | null>>({
    click: null,
    winding: null,
    unwinding: null,
  });
  const audioReadyRef = useRef(false);

  const safePlay = useCallback(async (key: SoundKey) => {
    const s = soundsRef.current[key];
    if (!audioReadyRef.current || !s) return;
    try {
      await s.setPositionAsync(0);
      await s.playAsync();
    } catch {}
  }, []);

  const stopNative = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  const startCycleFrom = useCallback(
    (fromValue: number) => {
      if (!isMountedRef.current) return;
      if (!isRunningRef.current) return;

      const from = Number.isFinite(fromValue) ? fromValue : 0;
      const to = from + 1;

      spin.setValue(from);

      const a = Animated.timing(spin, {
        toValue: to,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      animRef.current = a;

      a.start(({ finished }) => {
        if (!finished) return;
        startCycleFrom(to);
      });
    },
    [spin]
  );

  const pause = useCallback(() => {
    isRunningRef.current = false;
    stopNative();
    spin.stopAnimation((v) => {
      if (Number.isFinite(v)) spin.setValue(v);
    });
  }, [spin, stopNative]);

  const resume = useCallback(() => {
    isRunningRef.current = true;
    stopNative();
    spin.stopAnimation((v) => {
      const from = Number.isFinite(v) ? v : 0;
      spin.setValue(from);
      startCycleFrom(from);
    });
  }, [spin, startCycleFrom, stopNative]);

  useEffect(() => {
    isMountedRef.current = true;
    isRunningRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const click = await Audio.Sound.createAsync(
          require("../../assets/sounds/gear-click.mp3"),
          { shouldPlay: false, volume: 1.0 }
        );
        const winding = await Audio.Sound.createAsync(
          require("../../assets/sounds/gear-winding.mp3"),
          { shouldPlay: false, volume: 1.0 }
        );
        const unwinding = await Audio.Sound.createAsync(
          require("../../assets/sounds/gear-unwinding.mp3"),
          { shouldPlay: false, volume: 1.0 }
        );

        if (cancelled) {
          await click.sound.unloadAsync();
          await winding.sound.unloadAsync();
          await unwinding.sound.unloadAsync();
          return;
        }

        soundsRef.current.click = click.sound;
        soundsRef.current.winding = winding.sound;
        soundsRef.current.unwinding = unwinding.sound;
        audioReadyRef.current = true;
      } catch {
        audioReadyRef.current = false;
        soundsRef.current.click = null;
        soundsRef.current.winding = null;
        soundsRef.current.unwinding = null;
      }
    })();

    resume();

    return () => {
      cancelled = true;

      isMountedRef.current = false;
      isRunningRef.current = false;

      stopNative();
      spin.stopAnimation();

      (async () => {
        try {
          audioReadyRef.current = false;
          const { click, winding, unwinding } = soundsRef.current;
          if (click) await click.unloadAsync();
          if (winding) await winding.unloadAsync();
          if (unwinding) await unwinding.unloadAsync();
        } catch {
        } finally {
          soundsRef.current.click = null;
          soundsRef.current.winding = null;
          soundsRef.current.unwinding = null;
        }
      })();
    };
  }, [resume, spin, stopNative]);

  // ---------------- RUNG 6: Mesh Tuner ----------------
  // Large gear placement
  const LARGE_W = 260;
  const LARGE_H = 260;
  const LARGE_X = -60;
  const LARGE_Y = -20;

  // Small gear placement (TUNE THESE)
  const SMALL_W = 170;
  const SMALL_H = 170;

  // Start with a better “tangent” guess:
  // distance ≈ (LARGE_W/2 + SMALL_W/2) - overlapFudge
  // We'll tune by eye.
  const SMALL_X = 120; // try 85, 95, 105...
  const SMALL_Y = 60; // try 45, 55, 65...

  // Gear ratio (TUNE THIS)
  // Roughly proportional to radii: (LARGE_W/2) / (SMALL_W/2) = LARGE_W/SMALL_W
  // 260/170 ≈ 1.529
  const SMALL_RATIO = 1.60;

  const rotateLarge = useMemo(() => {
    const outputRange =
      direction === 1 ? ["0deg", "360deg"] : ["0deg", "-360deg"];
    return spin.interpolate({
      inputRange: [0, 1],
      outputRange,
      extrapolate: "extend",
    });
  }, [spin, direction]);

  const rotateSmall = useMemo(() => {
    const ratioSpin = Animated.multiply(spin, SMALL_RATIO);
    const outputRange =
      direction === 1 ? ["0deg", "-360deg"] : ["0deg", "360deg"];
    return ratioSpin.interpolate({
      inputRange: [0, 1],
      outputRange,
      extrapolate: "extend",
    });
  }, [spin, direction]);

  const onToggleRun = useCallback(() => {
    setIsRunning((prev) => {
      const next = !prev;
      if (next) {
        void safePlay("winding");
        resume();
      } else {
        void safePlay("unwinding");
        pause();
      }
      return next;
    });
  }, [pause, resume, safePlay]);

  const onToggleDirection = useCallback(() => {
    void safePlay("click");
    setDirection((prev) => (prev === 1 ? -1 : 1));
  }, [safePlay]);

  // Visual “contact point” helper (optional)
  // We'll put a small dot where the centers would “touch” if tangent.
  const contactX = LARGE_X + LARGE_W / 2 + (SMALL_X - (SMALL_W / 2));
  const contactY = LARGE_Y + LARGE_H / 2 + (SMALL_Y - (SMALL_H / 2));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gears</Text>

      <Pressable
        style={styles.stage}
        onPress={onToggleRun}
        onLongPress={onToggleDirection}
      >
        <Animated.Image
          source={require("../../assets/gears/gear_silver_large.png")}
          resizeMode="contain"
          style={[
            styles.img,
            {
              width: LARGE_W,
              height: LARGE_H,
              transform: [
                { translateX: LARGE_X },
                { translateY: LARGE_Y },
                { rotate: rotateLarge },
              ],
            },
          ]}
        />

        <Animated.Image
          source={require("../../assets/gears/gear_silver_small.png")}
          resizeMode="contain"
          style={[
            styles.img,
            {
              width: SMALL_W,
              height: SMALL_H,
              transform: [
                { translateX: SMALL_X },
                { translateY: SMALL_Y },
                { rotate: rotateSmall },
              ],
            },
          ]}
        />

        {/* Contact point helper */}
        <View
          style={[
            styles.dot,
            { transform: [{ translateX: contactX }, { translateY: contactY }] },
          ]}
        />

        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            Tap: {isRunning ? "Pause" : "Resume"} • Long-press: Reverse
          </Text>
          <Text style={styles.overlayTextSmall}>
            Dir: {direction === 1 ? "CW" : "CCW"} • Ratio: {SMALL_RATIO.toFixed(2)}
          </Text>
          <Text style={styles.overlayTextSmall}>
            Small XY: {SMALL_X},{SMALL_Y} • Large XY: {LARGE_X},{LARGE_Y}
          </Text>
        </View>
      </Pressable>

      <Text style={styles.hint}>
        Rung 6: tune SMALL_X / SMALL_Y / SMALL_RATIO until it “meshes”
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginBottom: 12,
  },
  stage: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#12121A",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  img: {
    position: "absolute",
  },
  dot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  overlayText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  overlayTextSmall: {
    color: "#D5D5E2",
    fontSize: 12,
    marginTop: 4,
  },
  hint: {
    color: "#C9C9D6",
    marginTop: 12,
  },
});
