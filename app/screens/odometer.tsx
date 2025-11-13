// Fidget Frenzy – Odometer v0.9-dev unified
// Integrates soundManager + SettingsModal + Ionicons gear icon + cleaned types

import React, { useEffect, useState } from "react";
import { View, Image, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import { playSound, preloadSounds } from "../../lib/soundManager";

const { width: W, height: H } = Dimensions.get("window");

export default function OdometerScreen() {
  const router = useRouter();
  const progress = useSharedValue(0);
  const [mileage, setMileage] = useState(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // preload our sounds
  useEffect(() => {
    preloadSounds({
      screech: require("../../assets/sounds/screech.mp3"),
      "switch-click": require("../../assets/sounds/switch-click.mp3"),
    });
  }, []);

  // define the track path
  const radiusX = W * 0.35;
  const radiusY = H * 0.18;
  const centerX = W / 2;
  const centerY = H * 0.35;

  const animatedCarStyle = useAnimatedStyle(() => {
    const angle = progress.value * 2 * Math.PI;
    const x = centerX + radiusX * Math.cos(angle) - 25;
    const y = centerY + radiusY * Math.sin(angle) - 25;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${angle + Math.PI / 2}rad` },
      ],
    };
  });

  // animate car continuously
  useEffect(() => {
    const loop = () => {
      progress.value = withTiming(
        1,
        { duration: 8000, easing: Easing.linear },
        (finished) => {
          if (finished) {
            runOnJS(setMileage)((prev) => prev + 1);
            progress.value = 0;
            runOnJS(loop)();
          }
        }
      );
    };
    loop();
  }, []);

  // placeholder screech sound for turns
  const playScreech = async () => {
    if (!soundOn) return;
    await playSound("switch-click", require("../../assets/sounds/switch-click.mp3"));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // reset odometer
  const reset = () => {
    setMileage(0);
  };

  return (
    <FullscreenWrapper>
      <View style={[styles.container, { backgroundColor: "#081A34" }]}>
        {/* Header */}
        <View style={styles.topRow}>
          <BackButton />
          <Pressable onPress={() => setSettingsVisible(true)}>
            <Ionicons name="settings-sharp" size={28} color="#FDD017" />
          </Pressable>
        </View>

        {/* Track */}
        <Image
          source={require("../../assets/odometer/track.png")}
          style={styles.track}
          resizeMode="contain"
        />

        {/* Animated Car */}
        <Animated.Image
          source={require("../../assets/odometer/car_red.png")}
          style={[styles.car, animatedCarStyle]}
          resizeMode="contain"
        />

        {/* Odometer Display */}
        <View style={styles.odometerContainer}>
          <Text style={styles.odometerValue}>
            {mileage.toString().padStart(6, "0")}
          </Text>
          <Text style={styles.odometerLabel}>MILEAGE</Text>
        </View>

        {/* Settings Modal */}
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onReset={reset}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
        />
      </View>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 5,
  },
  track: {
    width: W * 0.9,
    height: H * 0.45,
  },
  car: {
    position: "absolute",
    width: 50,
    height: 50,
  },
  odometerContainer: {
    position: "absolute",
    bottom: 100,
    alignItems: "center",
  },
  odometerValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FDD017",
    letterSpacing: 2,
  },
  odometerLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 4,
  },
});
