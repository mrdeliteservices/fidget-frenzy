// app/screens/spinner-screen.tsx
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  FrameInfo,
} from "react-native-reanimated";

import HomeButton from "../../components/HomeButton";
import FullscreenWrapper from "../../components/FullscreenWrapper"; // ✅ hides status bar globally

// ---------- Config ----------
const CONFIG = {
  HUB_DIAMETER: 70,
  WEIGHT_DIAMETER: 90,
  ARM_LENGTH: 120,
  ARM_WIDTH: 74,
  PINCH_WIDTH: 34,
  BOOST_MULTIPLIER: 6,
  MIN_FLICK_THRESHOLD: 300,
  HARD_FLICK_THRESHOLD: 1000,
  DAMPING_PER_SECOND: 0.75,
  OMEGA_STOP: 15,
  HAPTIC_DEGREES: 90,
};

export default function SpinnerScreen() {
  const angle = useSharedValue(0);
  const omega = useSharedValue(0);
  const lastHapticAt = useSharedValue(0);

  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const dragStartAngle = useSharedValue(0);
  const dragStartRotation = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const bodyRef = useRef<View>(null);

  // ---------- Sound ----------
  const whooshRef = useRef<Audio.Sound | null>(null);
  const whooshPlaying = useRef(false);

  useEffect(() => {
    (async () => {
      const { sound: whoosh } = await Audio.Sound.createAsync(
        require("../../assets/sounds/whoosh-sound-effect-240257.mp3"),
        { isLooping: false, volume: 1.0 }
      );
      whooshRef.current = whoosh;
    })();

    return () => {
      whooshRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const stopSound = async () => {
    if (whooshRef.current) {
      await whooshRef.current.stopAsync().catch(() => {});
      await whooshRef.current.setPositionAsync(0).catch(() => {});
      whooshRef.current.setOnPlaybackStatusUpdate(null);
    }
    whooshPlaying.current = false;
  };

  const playWhoosh = async () => {
    if (!whooshRef.current || whooshPlaying.current) return;
    const st = await whooshRef.current.getStatusAsync();
    if ("isPlaying" in st && st.isPlaying) return;

    whooshPlaying.current = true;
    whooshRef.current.setOnPlaybackStatusUpdate((s: any) => {
      if ("didJustFinish" in s && s.didJustFinish) {
        whooshPlaying.current = false;
        whooshRef.current?.setPositionAsync(0).catch(() => {});
        whooshRef.current?.setOnPlaybackStatusUpdate(null);
      }
    });
    await whooshRef.current.playFromPositionAsync(0);
  };

  // ---------- Layout ----------
  const onBodyLayout = () => {
    setTimeout(() => {
      bodyRef.current?.measureInWindow((x, y, w, h) => {
        centerX.value = x + w / 2;
        centerY.value = y + h / 2;
      });
    }, 0);
  };

  // ---------- Frame Loop ----------
  useFrameCallback((frame: FrameInfo) => {
    "worklet";
    const dt = frame.timeSincePreviousFrame ?? 0;
    if (dt <= 0) return;

    if (!isDragging.value) {
      angle.value += (omega.value * dt) / 1000;
      const factor = Math.pow(CONFIG.DAMPING_PER_SECOND, dt / 1000);
      omega.value *= factor;

      if (Math.abs(omega.value) < CONFIG.OMEGA_STOP) {
        omega.value = 0;
        runOnJS(stopSound)();
      }
    }

    const d = angle.value - lastHapticAt.value;
    if (Math.abs(d) >= CONFIG.HAPTIC_DEGREES) {
      lastHapticAt.value = angle.value;
      runOnJS(triggerHaptic)();
    }
  });

  // ---------- Gesture ----------
  const pan = Gesture.Pan()
    .onBegin((e: any) => {
      runOnJS(stopSound)();
      isDragging.value = true;

      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      dragStartAngle.value = Math.atan2(dy, dx);
      dragStartRotation.value = angle.value;
      omega.value = 0;
    })
    .onChange((e: any) => {
      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const a = Math.atan2(dy, dx);
      const deltaDeg = ((a - dragStartAngle.value) * 180) / Math.PI;
      angle.value = dragStartRotation.value + deltaDeg;
    })
    .onEnd((e: any) => {
      isDragging.value = false;
      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const r = Math.max(Math.hypot(dx, dy), 1);

      const tx = -dy / r;
      const ty = dx / r;
      const tangential = e.velocityX * tx + e.velocityY * ty;
      const omegaDegPerS = ((tangential / r) * 180) / Math.PI;

      if (Math.abs(omegaDegPerS) > CONFIG.MIN_FLICK_THRESHOLD) {
        const strength = Math.min(Math.abs(omegaDegPerS) / 2000, 1);
        omega.value = omegaDegPerS * (CONFIG.BOOST_MULTIPLIER * strength);

        if (Math.abs(omegaDegPerS) > CONFIG.HARD_FLICK_THRESHOLD) {
          runOnJS(playWhoosh)();
        }
      } else {
        runOnJS(stopSound)();
      }
    });

  // ---------- Animation ----------
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const ArmGroup = ({ angle: armAngle }: { angle: string }) => (
    <View style={[styles.armGroup, { transform: [{ rotate: armAngle }] }]}>
      <LinearGradient
        colors={["#444", "#aaa", "#444"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.armBase,
          {
            width: CONFIG.ARM_WIDTH,
            height: CONFIG.ARM_LENGTH,
            transform: [{ translateY: -CONFIG.ARM_LENGTH / 2 }],
          },
        ]}
      >
        <View
          style={[
            styles.pinch,
            { width: CONFIG.PINCH_WIDTH, top: CONFIG.ARM_LENGTH / 2 - 16 },
          ]}
        />
      </LinearGradient>

      <LinearGradient
        colors={["#222", "#bbb", "#222"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.weightRim,
          {
            width: CONFIG.WEIGHT_DIAMETER,
            height: CONFIG.WEIGHT_DIAMETER,
            borderRadius: CONFIG.WEIGHT_DIAMETER / 2,
            transform: [{ translateY: -CONFIG.ARM_LENGTH }],
          },
        ]}
      >
        <LinearGradient
          colors={["#3b82f6", "#2563eb", "#1e40af"]}
          start={{ x: 0.3, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.weightCore,
            {
              width: CONFIG.WEIGHT_DIAMETER * 0.65,
              height: CONFIG.WEIGHT_DIAMETER * 0.65,
              borderRadius: (CONFIG.WEIGHT_DIAMETER * 0.65) / 2,
            },
          ]}
        />
      </LinearGradient>
    </View>
  );

  // ---------- Render ----------
  return (
    <FullscreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>🌀 Spinner</Text>

        <GestureDetector gesture={pan}>
          <Animated.View
            ref={bodyRef}
            onLayout={onBodyLayout}
            style={[styles.spinnerBody, animatedStyle]}
          >
            <LinearGradient
              colors={["#7c2d12", "#f59e0b", "#7c2d12"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.hub,
                {
                  width: CONFIG.HUB_DIAMETER,
                  height: CONFIG.HUB_DIAMETER,
                  borderRadius: CONFIG.HUB_DIAMETER / 2,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <LinearGradient
                colors={["#fbbf24", "#d97706", "#78350f"]}
                start={{ x: 0.3, y: 0.3 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: CONFIG.HUB_DIAMETER * 0.75,
                  height: CONFIG.HUB_DIAMETER * 0.75,
                  borderRadius: (CONFIG.HUB_DIAMETER * 0.75) / 2,
                }}
              />
            </LinearGradient>

            <ArmGroup angle="0deg" />
            <ArmGroup angle="120deg" />
            <ArmGroup angle="240deg" />
          </Animated.View>
        </GestureDetector>

        <HomeButton />
      </View>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  title: {
    position: "absolute",
    top: 50,
    fontSize: 22,
    fontWeight: "700",
    color: "white",
  },
  spinnerBody: {
    width: 320,
    height: 320,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  hub: {
    borderWidth: 3,
    borderColor: "#111",
    zIndex: 3,
  },
  armGroup: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  armBase: {
    position: "absolute",
    borderRadius: 999,
  },
  pinch: {
    position: "absolute",
    height: 32,
    borderRadius: 999,
    alignSelf: "center",
    backgroundColor: "#0b1220",
  },
  weightRim: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  weightCore: {
    borderWidth: 3,
    borderColor: "#111",
  },
});
