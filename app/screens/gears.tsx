import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import { Audio } from "expo-av";

type SoundKey = "click" | "winding" | "unwinding";

export default function Gears() {
  // Spin grows continuously: 0 -> 1 -> 2 -> ...
  const spin = useRef(new Animated.Value(0)).current;

  // Labels only
  const [isRunning, setIsRunning] = useState(true);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Internal refs
  const isRunningRef = useRef(true);
  const isMountedRef = useRef(true);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // ---- Audio (Rung 4B) ----
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
    } catch (e) {
      console.log(`SOUND PLAY FAILED (${key})`, e);
    }
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

  // Load/unload audio once per mount
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
      } catch (e) {
        console.log("GEARS AUDIO LOAD FAILED", e);
        audioReadyRef.current = false;
        soundsRef.current.click = null;
        soundsRef.current.winding = null;
        soundsRef.current.unwinding = null;
      }
    })();

    // Start animation on mount
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
          // ignore
        } finally {
          soundsRef.current.click = null;
          soundsRef.current.winding = null;
          soundsRef.current.unwinding = null;
        }
      })();
    };
  }, [resume, spin, stopNative]);

  // ---------------- RUNG 5: Second gear rotation ----------------
  // Gear ratio illusion: small spins faster than large
  const SMALL_RATIO = 1.8;

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
    // Small gear rotates opposite direction of large + faster ratio
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

      // Discrete audio only
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gears</Text>

      <Pressable
        style={styles.stage}
        onPress={onToggleRun}
        onLongPress={onToggleDirection}
      >
        {/* Large gear */}
        <Animated.Image
          source={require("../../assets/gears/gear_silver_large.png")}
          resizeMode="contain"
          style={[
            styles.img,
            {
              width: 260,
              height: 260,
              transform: [
                { translateX: -60 },
                { translateY: -20 },
                { rotate: rotateLarge },
              ],
            },
          ]}
        />

        {/* Small gear: now rotates opposite + faster (Rung 5) */}
        <Animated.Image
          source={require("../../assets/gears/gear_silver_small.png")}
          resizeMode="contain"
          style={[
            styles.img,
            {
              width: 170,
              height: 170,
              transform: [
                { translateX: 70 },
                { translateY: 60 },
                { rotate: rotateSmall },
              ],
            },
          ]}
        />

        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            Tap: {isRunning ? "Pause" : "Resume"} • Long-press: Reverse
          </Text>
          <Text style={styles.overlayTextSmall}>
            Status: {isRunning ? "Running" : "Paused"} • Direction:{" "}
            {direction === 1 ? "CW" : "CCW"} • Small ratio: {SMALL_RATIO}x
          </Text>
        </View>
      </Pressable>

      <Text style={styles.hint}>
        Rung 5: second gear rotates opposite direction (faster ratio)
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
