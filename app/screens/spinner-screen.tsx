// app/screens/spinner-screen.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  FrameInfo,
} from "react-native-reanimated";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import BackButton from "../../components/BackButton";
import FullscreenWrapper from "../../components/FullscreenWrapper";
import SettingsModal from "../../components/SettingsModal";

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
};

const BRAND = { blue: "#0B1E3D", gold: "#FDD017", silver: "#C0C0C0" };

export default function SpinnerScreen() {
  // motion state
  const angle = useSharedValue(0);                 // total rotation (deg), continuous/unbounded
  const omega = useSharedValue(0);                 // angular velocity (deg/s)
  const lastCountAt = useSharedValue(0);           // last angle at which we incremented count (deg)
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const dragStartRotation = useSharedValue(0);     // angle at drag begin
  const isDragging = useSharedValue(false);

  // NEW: unwrap support for dragging
  const prevDragAngle = useSharedValue(0);         // previous raw atan2 (rad)
  const cumulativeDragDelta = useSharedValue(0);   // accumulated drag delta (deg, continuous)

  const bodyRef = useRef<View>(null);

  // React state
  const [spinCount, setSpinCount] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // mounted guard
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------- Sound ----------
  const whooshRef = useRef<Audio.Sound | null>(null);
  const whooshPlaying = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/whoosh-sound-effect-240257.mp3"),
          { isLooping: false, volume: 1.0 }
        );
        if (!cancelled) whooshRef.current = sound;
        else await sound.unloadAsync();
      } catch {}
    })();
    return () => {
      cancelled = true;
      whooshRef.current?.unloadAsync().catch(() => {});
      whooshRef.current = null;
    };
  }, []);

  const playWhoosh = async () => {
    if (!mountedRef.current || !soundOn) return;
    const snd = whooshRef.current;
    if (!snd || whooshPlaying.current) return;
    try {
      const st = await snd.getStatusAsync();
      if ("isPlaying" in st && st.isPlaying) return;

      whooshPlaying.current = true;
      snd.setOnPlaybackStatusUpdate((s: any) => {
        if ("didJustFinish" in s && s.didJustFinish) {
          whooshPlaying.current = false;
          snd.setPositionAsync(0).catch(() => {});
          snd.setOnPlaybackStatusUpdate(null);
        }
      });
      await snd.playFromPositionAsync(0);
    } catch {
      whooshPlaying.current = false;
    }
  };

  const stopSound = async () => {
    const snd = whooshRef.current;
    if (!snd) return;
    try {
      await snd.stopAsync();
      await snd.setPositionAsync(0);
      snd.setOnPlaybackStatusUpdate(null);
    } catch {}
    whooshPlaying.current = false;
  };

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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

  // ---------- Counter ----------
  const incrementSpinCount = () => {
    if (mountedRef.current) setSpinCount((p) => p + 1);
  };
  const resetSpinCount = () => {
    if (mountedRef.current) setSpinCount(0);
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

    // Count every full 360° rotation (CW or CCW)
    const deltaSinceCount = Math.abs(angle.value - lastCountAt.value);
    if (deltaSinceCount >= 360) {
      lastCountAt.value = angle.value;
      runOnJS(triggerHaptic)();
      runOnJS(incrementSpinCount)();
    }
  });

  // ---------- Gesture ----------
  const pan = Gesture.Pan()
    .onBegin((e: any) => {
      runOnJS(stopSound)();
      isDragging.value = true;

      // record starting rotation and reset unwrap accumulators
      dragStartRotation.value = angle.value;

      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const a0 = Math.atan2(dy, dx); // radians
      prevDragAngle.value = a0;
      cumulativeDragDelta.value = 0; // degrees

      omega.value = 0;
    })
    .onChange((e: any) => {
      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const a = Math.atan2(dy, dx); // current raw angle (rad)

      // unwrap: keep diff inside (-PI, PI]
      let diff = a - prevDragAngle.value;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff <= -Math.PI) diff += 2 * Math.PI;

      // accumulate continuous rotation (in degrees)
      cumulativeDragDelta.value += (diff * 180) / Math.PI;
      prevDragAngle.value = a;

      // set absolute spinner angle from start + accumulated drag
      angle.value = dragStartRotation.value + cumulativeDragDelta.value;

      // Count during drag as well
      const deltaSinceCount = Math.abs(angle.value - lastCountAt.value);
      if (deltaSinceCount >= 360) {
        lastCountAt.value = angle.value;
        runOnJS(triggerHaptic)();
        runOnJS(incrementSpinCount)();
      }
    })
    .onEnd((e: any) => {
      isDragging.value = false;

      // compute tangential velocity for flick
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
        {/* Header */}
        <View style={styles.headerRow}>
          <BackButton />
          <Ionicons
            name="settings-sharp"
            size={26}
            color={BRAND.silver}
            onPress={() => setSettingsVisible(true)}
          />
        </View>

        {/* Centered Counter */}
        <View pointerEvents="none" style={styles.counterCenter}>
          <Text style={styles.counterText}>🌀 Spins: {spinCount}</Text>
        </View>

        {/* Spinner */}
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

        {/* Settings Modal */}
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onReset={resetSpinCount}
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  headerRow: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  counterCenter: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9,
  },
  counterText: {
    color: BRAND.gold,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  spinnerBody: {
    width: 320,
    height: 320,
    justifyContent: "center",
    alignItems: "center",
  },
  hub: { borderWidth: 3, borderColor: "#111", zIndex: 3 },
  armGroup: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  armBase: { position: "absolute", borderRadius: 999 },
  pinch: {
    position: "absolute",
    height: 32,
    borderRadius: 999,
    alignSelf: "center",
    backgroundColor: "#0b1220",
  },
  weightRim: { position: "absolute", justifyContent: "center", alignItems: "center" },
  weightCore: { borderWidth: 3, borderColor: "#111" },
});
