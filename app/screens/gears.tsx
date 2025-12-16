import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Gears() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gears</Text>

      <View style={styles.stage}>
        {/* RUNG 1: Static layout ONLY.
            No animations. No audio. No timers. */}
        <View style={[styles.gear, styles.gearLarge]} />
        <View style={[styles.gear, styles.gearSmall]} />
      </View>

      <Text style={styles.hint}>Rung 1: static layout</Text>
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
  gear: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 10,
    borderColor: "#A7A7B5",
    backgroundColor: "transparent",
    opacity: 0.9,
  },
  gearLarge: {
    width: 220,
    height: 220,
    transform: [{ translateX: -60 }, { translateY: -20 }],
  },
  gearSmall: {
    width: 140,
    height: 140,
    transform: [{ translateX: 70 }, { translateY: 60 }],
    borderColor: "#7F7F93",
  },
  hint: {
    color: "#C9C9D6",
    marginTop: 12,
  },
});
