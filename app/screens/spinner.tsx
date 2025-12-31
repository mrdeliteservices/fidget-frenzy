// app/screens/spinner.tsx
// Fidget Frenzy – Spinner (v0.8-dev behavior, updated asset name)
// Physics & interaction logic preserved exactly; audio mapped to whoosh-1.mp3
// Premium pass: visual/material polish only (no mechanic changes, no new deps)
// + Option A: subtle world spotlight + vignette (reduces “dark void”)

import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackButton from "../../components/BackButton";
import FullscreenWrapper from "../../components/FullscreenWrapper";
import SettingsModal from "../../components/SettingsModal";
import GameHeader from "../../components/GameHeader";

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

export default function Spinner() {
  const insets = useSafeAreaInsets();

  // motion state
  const angle = useSharedValue(0); // total rotation (deg), continuous/unbounded
  const omega = useSharedValue(0); // angular velocity (deg/s)
  const lastCountAt = useSharedValue(0); // last angle at which we incremented count (deg)
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const dragStartRotation = useSharedValue(0); // angle at drag begin
  const isDragging = useSharedValue(false);

  // unwrap support for dragging
  const prevDragAngle = useSharedValue(0); // previous raw atan2 (rad)
  const cumulativeDragDelta = useSharedValue(0); // accumulated drag delta (deg, continuous)

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
          require("../../assets/sounds/whoosh-1.mp3"),
          { isLooping: false, volume: 1.0 }
        );
        if (!cancelled) {
          whooshRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch {
        // silent fail
      }
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

      dragStartRotation.value = angle.value;

      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const a0 = Math.atan2(dy, dx);
      prevDragAngle.value = a0;
      cumulativeDragDelta.value = 0;

      omega.value = 0;
    })
    .onChange((e: any) => {
      const dx = e.absoluteX - centerX.value;
      const dy = e.absoluteY - centerY.value;
      const a = Math.atan2(dy, dx);

      let diff = a - prevDragAngle.value;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff <= -Math.PI) diff += 2 * Math.PI;

      cumulativeDragDelta.value += (diff * 180) / Math.PI;
      prevDragAngle.value = a;

      angle.value = dragStartRotation.value + cumulativeDragDelta.value;

      const deltaSinceCount = Math.abs(angle.value - lastCountAt.value);
      if (deltaSinceCount >= 360) {
        lastCountAt.value = angle.value;
        runOnJS(triggerHaptic)();
        runOnJS(incrementSpinCount)();
      }
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
      {/* Arm: brushed metal with a clean sheen + subtle edge */}
      <LinearGradient
        colors={["#101318", "#6b7280", "#e5e7eb", "#4b5563", "#0f172a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.armBase,
          {
            width: CONFIG.ARM_WIDTH,
            height: CONFIG.ARM_LENGTH,
            transform: [{ translateY: -CONFIG.ARM_LENGTH / 2 }],
          },
        ]}
      >
        {/* Inner shadow strip to give “machined” depth */}
        <View style={styles.armInnerShadow} pointerEvents="none" />
        {/* Pinch / cutout reads as inset */}
        <View
          style={[
            styles.pinch,
            { width: CONFIG.PINCH_WIDTH, top: CONFIG.ARM_LENGTH / 2 - 16 },
          ]}
        />
        <View style={styles.pinchEdge} pointerEvents="none" />
      </LinearGradient>

      {/* Weight: rim + inner face */}
      <LinearGradient
        colors={["#0b0f16", "#a3aab6", "#eef2f7", "#6b7280", "#0b0f16"]}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
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
          colors={["#0b1b3a", "#2563eb", "#0b1b3a"]}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.weightCore,
            {
              width: CONFIG.WEIGHT_DIAMETER * 0.68,
              height: CONFIG.WEIGHT_DIAMETER * 0.68,
              borderRadius: (CONFIG.WEIGHT_DIAMETER * 0.68) / 2,
            },
          ]}
        >
          <View style={styles.weightSpec} pointerEvents="none" />
        </LinearGradient>

        <View style={styles.weightRimSpec} pointerEvents="none" />
      </LinearGradient>
    </View>
  );

  return (
    <FullscreenWrapper>
      <View style={styles.root}>
        {/* BACKGROUND DEPTH (no new deps): stacked gradients */}
        <LinearGradient
          colors={["#0a1326", "#0b1220"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.6, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(59,130,246,0.08)", "rgba(59,130,246,0)"]}
          start={{ x: 0.9, y: 0.0 }}
          end={{ x: 0.3, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />

        {/* ✅ Option A: WORLD SPOTLIGHT + VIGNETTE (minor change only) */}
        <LinearGradient
          colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0)"]}
          start={{ x: 0.5, y: 0.45 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)"]}
          start={{ x: 0.5, y: 0.2 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* HEADER (safe-area aware, no magic numbers) */}
        <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
          <GameHeader
            left={<BackButton />}
            centerLabel="Spins:"
            centerValue={spinCount}
            onPressSettings={() => setSettingsVisible(true)}
          />
        </View>

        {/* CONTENT: centered below the header */}
        <View style={styles.content}>
          {/* subtle stage ring behind spinner */}
          <View style={styles.stageRing} pointerEvents="none" />
          <View style={styles.stageRingInner} pointerEvents="none" />

          <GestureDetector gesture={pan}>
            <Animated.View
              ref={bodyRef}
              onLayout={onBodyLayout}
              style={[styles.spinnerBody, animatedStyle]}
            >
              {/* HUB: machined brass */}
              <LinearGradient
                colors={["#2b1a08", "#f59e0b", "#8a4b10"]}
                start={{ x: 0.1, y: 0.1 }}
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
                  colors={["#ffd36a", "#d97706", "#7c2d12"]}
                  start={{ x: 0.2, y: 0.2 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: CONFIG.HUB_DIAMETER * 0.78,
                    height: CONFIG.HUB_DIAMETER * 0.78,
                    borderRadius: (CONFIG.HUB_DIAMETER * 0.78) / 2,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {/* inner cap */}
                  <View style={styles.hubCap} />
                </LinearGradient>

                {/* spec highlight */}
                <View style={styles.hubSpec} pointerEvents="none" />
              </LinearGradient>

              <ArmGroup angle="0deg" />
              <ArmGroup angle="120deg" />
              <ArmGroup angle="240deg" />
            </Animated.View>
          </GestureDetector>
        </View>

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
  root: {
    flex: 1,
    backgroundColor: "#0b1220",
  },

  headerWrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 20,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  spinnerBody: {
    width: 320,
    height: 320,
    justifyContent: "center",
    alignItems: "center",
  },

  // Stage rings behind spinner to make it feel “mounted”
  stageRing: {
    position: "absolute",
    width: 308,
    height: 308,
    borderRadius: 154,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  stageRingInner: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },

  // Hub
  hub: {
    zIndex: 3,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  hubCap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  hubSpec: {
    position: "absolute",
    top: 10,
    left: 12,
    width: 26,
    height: 18,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.20)",
    transform: [{ rotate: "-18deg" }],
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
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    overflow: "hidden",
  },
  armInnerShadow: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 6,
    bottom: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.10)",
  },

  pinch: {
    position: "absolute",
    height: 32,
    borderRadius: 999,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pinchEdge: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },

  weightRim: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.60)",
    shadowColor: "#000",
    shadowOpacity: 0.30,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    overflow: "hidden",
  },

  weightCore: {
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  weightSpec: {
    position: "absolute",
    top: 8,
    left: 10,
    width: 28,
    height: 20,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    transform: [{ rotate: "-18deg" }],
  },
  weightRimSpec: {
    position: "absolute",
    top: 8,
    left: 14,
    width: 44,
    height: 30,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    transform: [{ rotate: "-18deg" }],
  },
});
