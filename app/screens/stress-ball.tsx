import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  SafeAreaView,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import FullscreenWrapper from "../../components/FullscreenWrapper"; // ✅ hides status bar globally

const BRAND = { blue: "#0B1E3D", purple: "#A249C0", gold: "#FDD017" };

export default function StressBall() {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const squeeze = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.82,
        useNativeDriver: true,
        speed: 14,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 10,
        bounciness: 6,
      }),
    ]).start();
  };

  return (
    <FullscreenWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: BRAND.blue }]}>
        <View style={styles.header}>
          <Text onPress={() => router.back()} style={styles.back}>
            ‹ Back
          </Text>
          <Text style={styles.title}>Stress Ball</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.center}>
          <TouchableWithoutFeedback onPress={squeeze}>
            <Animated.View style={[styles.ball, { transform: [{ scale }] }]} />
          </TouchableWithoutFeedback>
          <Text style={styles.hint}>Tap to squeeze</Text>
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

const SIZE = 200;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: "#fff", fontSize: 18, opacity: 0.9 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ball: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: BRAND.purple,
    shadowColor: BRAND.gold,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    borderWidth: 3,
    borderColor: "rgba(0,0,0,0.25)",
  },
  hint: { color: "rgba(255,255,255,0.8)", marginTop: 16, fontSize: 14 },
});
