// Fidget Frenzy – Stress Ball v0.9-dev unified
// Expo SDK 54 / RN 0.81
// Interactive squish orb with shared SettingsModal + soundManager
// ✅ Header standardized via GameHeader (Back + "Squeezes:" + Settings)
// ✅ Header pinned w/ tunable top offset (Spinner-sage Phase 2 fix)
// ✅ Phase I: PremiumStage + stable “world” teal gradient + stage spacing (Odometer pattern)
// ✅ Shine OFF for this game (ball shouldn’t sit under a gray cap)
// ✅ Stage surface forced to Gears top tone gray (no more black)

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
import PremiumStage from "../../components/PremiumStage";
import GameHeader from "../../components/GameHeader";
import { frenzyTheme as t } from "../theme/frenzyTheme";
import { playSound, preloadSounds } from "../../lib/soundManager";

const { width: W } = Dimensions.get("window");
const BALL_SIZE = W * 0.4;

const HEADER_TOP = 65;

// ✅ World is stable, teal gradient, non-reactive (lighter → darker)
const STRESS_WORLD = {
  top: "#7CF7E6",
  mid: "#2DD4BF",
  bottom: "#0B5C59",
};

// ✅ Stage surface (Gears “top tone” — not-black)
const STRESS_STAGE_SURFACE = "#36353A";

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
          <LinearGradient
            colors={[STRESS_WORLD.top, STRESS_WORLD.mid, STRESS_WORLD.bottom]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.headerWrap} pointerEvents="box-none">
            <GameHeader
              left={<BackButton />}
              centerLabel="Squeezes:"
              centerValue={pressCount}
              onPressSettings={() => setSettingsVisible(true)}
            />
          </View>

          <View style={styles.stageWrap}>
            <View style={styles.stageShell}>
              <PremiumStage
                showShine={false}
                style={{ backgroundColor: STRESS_STAGE_SURFACE }} // ✅ force not-black stage
              >
                <View style={styles.content}>
                  <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
                    <Animated.View style={[styles.ball, animatedStyle]}>
                      <LinearGradient
                        colors={["#16a34a", "#22c55e", "#166534"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ballGradient}
                      />
                    </Animated.View>
                  </Pressable>
                </View>
              </PremiumStage>
            </View>
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
  root: { flex: 1 },
  safe: { flex: 1 },

  headerWrap: {
    position: "absolute",
    top: HEADER_TOP,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 20,
  },

  stageWrap: {
    flex: 1,
    paddingHorizontal: t.spacing.stageMarginH,
    paddingTop: t.spacing.stageMarginTop + 72,
    paddingBottom: t.spacing.stageMarginBottom,
  },

  stageShell: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
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

  ballGradient: {
    flex: 1,
    borderRadius: BALL_SIZE / 2,
  },
});
