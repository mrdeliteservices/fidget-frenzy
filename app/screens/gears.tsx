import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, Animated, Easing } from "react-native";

export default function Gears() {
  // Single animated value for ONE gear only (keep it simple for rung 2)
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset to a known state on mount
    spin.setValue(0);

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000, // tweak later; keep stable for now
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    // Important: stop cleanly on unmount to avoid runaway native animation
    return () => {
      animation.stop();
      spin.stopAnimation();
    };
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gears</Text>

      <View style={styles.stage}>
        {/* RUNG 2:
            - Animate ONE gear only
            - No audio
            - No interaction
        */}
        <Animated.Image
          source={require("../../assets/gears/gear_silver_large.png")}
          style={[styles.img, styles.large, { transform: [{ rotate }, ...styles.large.transform] }]}
          resizeMode="contain"
        />

        {/* Small gear stays static for this rung */}
        <Image
          source={require("../../assets/gears/gear_silver_small.png")}
          style={[styles.img, styles.small]}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.hint}>Rung 2: one gear rotates (no audio)</Text>
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

  // NOTE: We keep the translate transform here, and in the component we
  // prepend rotate so rotation happens around the image center.
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

  hint: {
    color: "#C9C9D6",
    marginTop: 12,
  },
});
