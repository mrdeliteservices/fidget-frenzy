import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  SafeAreaView,
} from "react-native";
import * as Haptics from "expo-haptics";
import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton"; // ✅ unified navigation

const BRAND = { blue: "#0B1E3D", purple: "#A249C0", gold: "#FDD017" };

export default function SliderSwitch() {
  const [on, setOn] = useState(false);
  const knobX = useRef(new Animated.Value(0)).current;

  const toggle = async () => {
    const next = !on;
    setOn(next);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.timing(knobX, {
      toValue: next ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const translateX = knobX.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 64],
  });

  const trackColor = knobX.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.15)", BRAND.purple],
  });

  return (
    <FullscreenWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: BRAND.blue }]}>
        {/* ✅ Clean BackButton only (no header or title) */}
        <BackButton />

        <View style={styles.center}>
          <TouchableWithoutFeedback onPress={toggle}>
            <Animated.View
              style={[styles.track, { backgroundColor: trackColor as any }]}
            >
              <Animated.View
                style={[styles.knob, { transform: [{ translateX }] }]}
              />
            </Animated.View>
          </TouchableWithoutFeedback>

          <Text style={styles.state}>{on ? "ON" : "OFF"}</Text>
          <Text style={styles.hint}>Tap the switch</Text>
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  track: {
    width: 112,
    height: 44,
    borderRadius: 22,
    padding: 4,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.25)",
  },
  knob: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  state: { color: "#fff", fontSize: 18, marginTop: 16, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.75)", marginTop: 8, fontSize: 13 },
});
