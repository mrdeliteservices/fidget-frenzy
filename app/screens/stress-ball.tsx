// Fidget Frenzy – Stress Ball v0.9-dev unified
// Expo SDK 54 / RN 0.81
// Interactive squish orb with shared SettingsModal + soundManager

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Text,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import { playSound, preloadSounds } from "../../lib/soundManager";

const { width: W, height: H } = Dimensions.get("window");

export default function StressBallScreen() {
  const [soundOn, setSoundOn] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [pressCount, setPressCount] = useState(0);

  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  // preload all stress-ball sounds
  useEffect(() => {
    preloadSounds({
      squish: require("../../assets/sounds/squish.mp3"),
      pop: require("../../assets/sounds/pop.mp3"),
      bubble: require("../../assets/sounds/bubble.mp3"),
    });

    // gentle idle pulse animation
    pulse.value = withRepeat(
      withSequence(
        withSpring(1.03, { stiffness: 60, damping: 10 }),
        withSpring(0.97, { stiffness: 60, damping: 10 })
      ),
      -1,
      true
    );
  }, []);

  // animated squish
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  const handlePressIn = async () => {
    scale.value = withSpring(0.8, { stiffness: 150, damping: 12 });
    if (soundOn) await playSound("squish", require("../../assets/sounds/squish.mp3"));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePressOut = async () => {
    setPressCount((p) => p + 1);
    scale.value = withSpring(1.1, { stiffness: 150, damping: 10 }, () => {
      scale.value = withSpring(1);
    });
    if (soundOn) await playSound("pop", require("../../assets/sounds/pop.mp3"));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const reset = () => {
    setPressCount(0);
  };

  return (
    <FullscreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <Ionicons
            name="settings-sharp"
            size={28}
            color="#FDD017"
            onPress={() => setSettingsVisible(true)}
          />
        </View>

        {/* Counter */}
        <Text style={styles.counter}>Squeezes: {pressCount}</Text>

        {/* Stress Ball */}
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <Animated.View style={[styles.ball, animatedStyle]}>
            <LinearGradient
              colors={["#16a34a", "#22c55e", "#166534"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            />
          </Animated.View>
        </Pressable>

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
    backgroundColor: "#081A34",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  ball: {
    width: W * 0.4,
    height: W * 0.4,
    borderRadius: (W * 0.4) / 2,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
  },
  gradient: {
    flex: 1,
    borderRadius: (W * 0.4) / 2,
  },
  counter: {
    position: "absolute",
    top: 100,
    color: "#FDD017",
    fontSize: 18,
    fontWeight: "600",
  },
});
