import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import FullscreenWrapper from "../../components/FullscreenWrapper"; // ✅ hides status bar globally

const BRAND = { blue: "#0B1E3D", purple: "#A249C0", gold: "#FDD017" };

export default function Gears() {
  const router = useRouter();
  const spinA = useRef(new Animated.Value(0)).current;
  const spinB = useRef(new Animated.Value(0)).current;
  const [running, setRunning] = useState(true);

  const loop = (val: Animated.Value, duration: number) =>
    Animated.loop(
      Animated.timing(val, { toValue: 1, duration, useNativeDriver: true })
    );

  useEffect(() => {
    const a = loop(spinA, 4000);
    const b = loop(spinB, 6000);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [spinA, spinB]);

  const toggle = async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    setRunning((r) => {
      if (r) {
        spinA.stopAnimation();
        spinB.stopAnimation();
      } else {
        loop(spinA, 4000).start();
        loop(spinB, 6000).start();
      }
      return !r;
    });
  };

  const rotA = spinA.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const rotB = spinB.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  return (
    <FullscreenWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: BRAND.blue }]}>
        <View style={styles.header}>
          <Text onPress={() => router.back()} style={styles.back}>
            ‹ Back
          </Text>
          <Text style={styles.title}>Gears</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.center}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Animated.Image
              source={require("../../assets/icons/gears.png")}
              style={[styles.gear, { transform: [{ rotate: rotA }] }]}
              resizeMode="contain"
            />
            <Animated.Image
              source={require("../../assets/icons/gears.png")}
              style={[styles.gearSmall, { transform: [{ rotate: rotB }] }]}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={toggle}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonTxt}>
              {running ? "Pause" : "Resume"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>No sound (disabled for now)</Text>
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

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
  gear: { width: 140, height: 140 },
  gearSmall: { width: 90, height: 90 },
  button: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: BRAND.purple,
    shadowColor: BRAND.gold,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  buttonTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.7)", marginTop: 10 },
});
