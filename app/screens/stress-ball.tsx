// Fidget Frenzy – Stress Ball v0.9-dev unified
// Expo SDK 54 / RN 0.81
// Interactive squish orb with shared SettingsModal + soundManager
// ✅ Header standardized via GameHeader (Back + "Squeezes:" + Settings)
// ✅ Header pinned w/ tunable top offset (Spinner-sage Phase 2 fix)

import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, SafeAreaView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import GameHeader from "../../components/GameHeader";
import { playSound, preloadSounds } from "../../lib/soundManager";

const { width: W } = Dimensions.get("window");
const BALL_SIZE = W * 0.4;

// 🔧 TUNING: match Spinner Phase 2 behavior
const HEADER_TOP = 65;

export default function StressBallScreen() {
  const [soundOn, setSoundOn] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [pressCount, setPressCount] = useState(0);

  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }));

  const handlePressIn = async () => {
    scale.value = withSpring(0.8, { stiffness: 150, damping: 12 });
    if (soundOn) {
      await playSound("squish", require("../../assets/sounds/squish.mp3"));
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePressOut = async () => {
    setPressCount((p) => p + 1);
    scale.value = withSpring(1.1, { stiffness: 150, damping: 10 }, () => {
      scale.value = withSpring(1);
    });
    if (soundOn) {
      await playSound("pop", require("../../assets/sounds/pop.mp3"));
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const reset = () => setPressCount(0);

  return (
    <FullscreenWrapper>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          {/* HEADER (pinned, Spinner-sage offset) */}
          <View style={styles.headerWrap}>
            <GameHeader
              left={<BackButton />}
              centerLabel="Squeezes:"
              centerValue={pressCount}
              onPressSettings={() => setSettingsVisible(true)}
            />
          </View>

          {/* CONTENT (centered independently) */}
          <View style={styles.content}>
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
          </View>

          <SettingsModal
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            onReset={reset}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
          />
        </SafeAreaView>
      </View>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#081A34",
  },
  safe: {
    flex: 1,
  },

  headerWrap: {
    position: "absolute",
    top: HEADER_TOP,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 20,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
  },
  gradient: {
    flex: 1,
    borderRadius: BALL_SIZE / 2,
  },
});
