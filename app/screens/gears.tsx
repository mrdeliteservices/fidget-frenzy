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

export default function Gears() {
  // One animated value for ONE gear
  const spin = useRef(new Animated.Value(0)).current;

  // Interaction state (Rung 3)
  const [isRunning, setIsRunning] = useState(true);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Keep the current progress so resume continues smoothly
  const progressRef = useRef(0);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startLoop = useCallback(() => {
    // Start from current progress and loop forever.
    // We animate from current value -> 1, then loop resets to 0.
    loopRef.current = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopRef.current.start();
  }, [spin]);

  const stopLoop = useCallback(() => {
    // Stop the running loop and capture current position for smooth resume
    loopRef.current?.stop();
    loopRef.current = null;

    spin.stopAnimation((value) => {
      // Value is between 0 and 1 (ish). Keep it bounded.
      const bounded = ((value % 1) + 1) % 1;
      progressRef.current = bounded;
      spin.setValue(bounded);
    });
  }, [spin]);

  useEffect(() => {
    // On mount, start running
    spin.setValue(progressRef.current);
    startLoop();

    // Clean unmount
    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
      spin.stopAnimation();
    };
  }, [spin, startLoop]);

  // When isRunning changes, start/stop (no audio, no extra effects)
  useEffect(() => {
    if (isRunning) {
      // Ensure the animated value resumes from saved progress
      spin.setValue(progressRef.current);
      startLoop();
    } else {
      stopLoop();
    }
  }, [isRunning, spin, startLoop, stopLoop]);

  const rotate = useMemo(() => {
    const output =
      direction === 1 ? ["0deg", "360deg"] : ["0deg", "-360deg"];
    return spin.interpolate({
      inputRange: [0, 1],
      outputRange: output,
    });
  }, [spin, direction]);

  const onToggleRun = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const onToggleDirection = useCallback(() => {
    setDirection((prev) => (prev === 1 ? -1 : 1));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gears</Text>

      <Pressable
        style={styles.stage}
        onPress={onToggleRun}
        onLongPress={onToggleDirection}
      >
        {/* RUNG 3:
            - Tap = pause/resume
            - Long-press = reverse direction
            - No audio
        */}
        <Animated.Image
          source={require("../../assets/gears/gear_silver_large.png")}
          style={[
            styles.img,
            styles.large,
            { transform: [{ rotate }, ...styles.large.transform] },
          ]}
          resizeMode="contain"
        />

        <Image
          source={require("../../assets/gears/gear_silver_small.png")}
          style={[styles.img, styles.small]}
          resizeMode="contain"
        />

        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            Tap: {isRunning ? "Pause" : "Resume"} • Long-press: Reverse
          </Text>
          <Text style={styles.overlayTextSmall}>
            Status: {isRunning ? "Running" : "Paused"} • Direction:{" "}
            {direction === 1 ? "CW" : "CCW"}
          </Text>
        </View>
      </Pressable>

      <Text style={styles.hint}>Rung 3: interaction (no audio)</Text>
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
  large: {
    width: 260,
    height: 260,
    transform: [{ translateX: -60 }, { translateY: -20 }],
  },
  small: {
    width: 170,
    height: 170,
    transform: [{ translateX: 70 }, { translateY: 60 }],
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
