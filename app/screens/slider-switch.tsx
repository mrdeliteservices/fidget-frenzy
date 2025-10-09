import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback, SafeAreaView } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

const BRAND = { blue: "#0B1E3D", purple: "#A249C0", gold: "#FDD017" };

export default function SliderSwitch() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const knobX = useRef(new Animated.Value(0)).current;

  const toggle = async () => {
    const next = !on;
    setOn(next);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    Animated.timing(knobX, {
      toValue: next ? 1 : 0, duration: 220, useNativeDriver: true,
    }).start();
  };

  const translateX = knobX.interpolate({ inputRange: [0, 1], outputRange: [4, 64] });
  const trackColor = knobX.interpolate({ inputRange: [0,1], outputRange: ["rgba(255,255,255,0.15)", BRAND.purple] });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: BRAND.blue }]}>
      <View style={styles.header}>
        <Text onPress={() => router.back()} style={styles.back}>‹ Back</Text>
        <Text style={styles.title}>Slider Switch</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.center}>
        <TouchableWithoutFeedback onPress={toggle}>
          <Animated.View style={[styles.track, { backgroundColor: trackColor as any }]}>
            <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
          </Animated.View>
        </TouchableWithoutFeedback>
        <Text style={styles.state}>{on ? "ON" : "OFF"}</Text>
        <Text style={styles.hint}>Tap the switch</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  back: { color: "#fff", fontSize: 18, opacity: 0.9 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  track: {
    width: 112, height: 44, borderRadius: 22, padding: 4,
    borderWidth: 2, borderColor: "rgba(0,0,0,0.25)"
  },
  knob: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }
  },
  state: { color: "#fff", fontSize: 18, marginTop: 16, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.75)", marginTop: 8, fontSize: 13 },
});
