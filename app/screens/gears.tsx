import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

export default function Gears() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gears</Text>

      <View style={styles.stage}>
        {/* RUNG 1.5: Static images ONLY.
            - No animations
            - No audio
            - No timers
            - No useEffect
        */}
        <Image
          source={require("../../assets/gears/gear_silver_large.png")}
          style={[styles.img, styles.large]}
          resizeMode="contain"
        />

        <Image
          source={require("../../assets/gears/gear_silver_small.png")}
          style={[styles.img, styles.small]}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.hint}>Rung 1.5: static gear images</Text>
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

  // Images
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

  hint: {
    color: "#C9C9D6",
    marginTop: 12,
  },
});
