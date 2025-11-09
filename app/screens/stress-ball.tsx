// app/screens/stress-ball.tsx
import React, { useMemo, useState } from "react";
import { View, StyleSheet, Dimensions, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Defs, RadialGradient, Stop, Circle, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

// ✅ your component paths
import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
// NOTE: SettingsModal removed here to avoid prop type conflicts; wire it once we confirm its Props

// Optional sound manager (safe if missing)
let Sound: {
  play?: (k: string) => void;
  stop?: (k: string) => void;
  loop?: (k: string, enable?: boolean) => void;
} = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sound = require("../../lib/soundManager");
} catch { /* noop */ }

// Theme
const THEME = {
  bg: "#081A34",
  accent: "#FDD017",
  calmBlue: "#0077FF",
  calmGreen: "#33FF99",
  tenseRed: "#E65050",
};

const { width: W, height: H } = Dimensions.get("window");

// Sizing
const BALL_RADIUS = Math.min(W, H) * 0.14;
const BALL_DIAM = BALL_RADIUS * 2;
const CENTER_X = W / 2;
const CENTER_Y = H * 0.60;

const SPRING = { damping: 18, stiffness: 220, mass: 0.6 };
const QUICK = { duration: 160, easing: Easing.out(Easing.quad) };
const PARTICLE_COUNT = 18;

// ✅ FIXED PARTICLE COMPONENT (moved up and wrapped)
const Particle = React.memo(function Particle({
  r,
  baseAngle,
  driftMs,
}: {
  r: number;
  baseAngle: number;
  driftMs: number;
}) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    t.value = withRepeat(
      withTiming(2 * Math.PI, { duration: driftMs, easing: Easing.linear }),
      -1,
      false
    );
  }, [t, driftMs]);

  const style = useAnimatedStyle(() => {
    const angle = baseAngle + t.value;
    const x = CENTER_X + Math.cos(angle) * r;
    const y = CENTER_Y + Math.sin(angle) * r * 0.9;
    return {
      transform: [{ translateX: x - 2.5 }, { translateY: y - 2.5 }],
      opacity: 0.25 + 0.25 * Math.sin(t.value + baseAngle),
    };
  });

  return <Animated.View style={[styles.particle, style]} pointerEvents="none" />;
});

export default function StressBallScreen() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false); // placeholder until SettingsModal is wired

  // Gesture state
  const touchX = useSharedValue(CENTER_X);
  const touchY = useSharedValue(CENTER_Y);
  const isTouching = useSharedValue(0);
  const squeeze = useSharedValue(0);
  const coreX = useSharedValue(CENTER_X);
  const coreY = useSharedValue(CENTER_Y);
  const swirl = useSharedValue(0);
  const ripple = useSharedValue(0);
  const mood = useSharedValue(0);

  // Idle swirl
  React.useEffect(() => {
    swirl.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, [swirl]);

  // Particles
  const particles = useMemo(
    () =>
      new Array(PARTICLE_COUNT).fill(0).map((_, i) => {
        const r = BALL_RADIUS * (0.15 + Math.random() * 0.75);
        const a = (i / PARTICLE_COUNT) * 2 * Math.PI + Math.random() * 0.5;
        const drift = 3000 + Math.random() * 4000;
        return { r, a, drift };
      }),
    []
  );

  // Gestures
  const pan = Gesture.Pan()
    .onBegin((e) => {
      isTouching.value = 1;
      touchX.value = e.x;
      touchY.value = e.y;
      squeeze.value = withTiming(0.5, QUICK);
      mood.value = withTiming(0.25, { duration: 300 });
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      if (Sound.play) Sound.play("grab");
      if (Sound.loop) Sound.loop("liquid_loop", true);
    })
    .onUpdate((e) => {
      touchX.value = e.x;
      touchY.value = e.y;
      const dx = e.x - CENTER_X;
      const dy = e.y - CENTER_Y;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), BALL_RADIUS);
      const depth = dist / BALL_RADIUS;
      const target = 0.35 + depth * 0.45;
      squeeze.value = withTiming(target, { duration: 90 });
      coreX.value = withSpring(CENTER_X + dx * 0.45, SPRING);
      coreY.value = withSpring(CENTER_Y + dy * 0.45, SPRING);
      mood.value = withTiming(Math.max(0, mood.value - 0.0015), { duration: 16 });
    })
    .onEnd(() => {
      isTouching.value = 0;
      squeeze.value = withSpring(0, SPRING);
      coreX.value = withSpring(CENTER_X, SPRING);
      coreY.value = withSpring(CENTER_Y, SPRING);
      ripple.value = 0;
      ripple.value = withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 260 })
      );
      mood.value = withTiming(0, { duration: 650, easing: Easing.out(Easing.quad) });
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      if (Sound.play) Sound.play("pop");
      if (Sound.loop) Sound.loop("liquid_loop", false);
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onStart(() => {
      ripple.value = 0;
      ripple.value = withSequence(
        withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 220 })
      );
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      if (Sound.play) Sound.play("plink");
    });

  const gesture = Gesture.Simultaneous(pan, tap);

  // Styles
  const shellStyle = useAnimatedStyle(() => {
    const breath = isTouching.value ? 0 : Math.sin(swirl.value) * 0.01;
    const baseScale = 1 + breath;
    const dx = touchX.value - CENTER_X;
    const dy = touchY.value - CENTER_Y;
    const angle = Math.atan2(dy, dx);
    const squishAmt = squeeze.value * 0.18;
    const scaleX = baseScale * (1 + squishAmt * Math.cos(angle));
    const scaleY = baseScale * (1 - squishAmt * Math.cos(angle));
    return {
      transform: [
        { translateX: CENTER_X - BALL_RADIUS },
        { translateY: CENTER_Y - BALL_RADIUS },
        { translateX: BALL_RADIUS },
        { translateY: BALL_RADIUS },
        { scaleX },
        { scaleY },
        { translateX: -BALL_RADIUS },
        { translateY: -BALL_RADIUS },
      ],
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const idleX = Math.cos(swirl.value) * BALL_RADIUS * 0.08;
    const idleY = Math.sin(swirl.value) * BALL_RADIUS * 0.08;
    return {
      transform: [
        { translateX: coreX.value + idleX - BALL_RADIUS },
        { translateY: coreY.value + idleY - BALL_RADIUS },
      ],
    };
  });

  const rippleStyle = useAnimatedStyle(() => {
    const r = interpolate(ripple.value, [0, 1], [BALL_RADIUS * 0.92, BALL_RADIUS * 1.25]);
    const o = interpolate(ripple.value, [0, 1], [0, 0.5]);
    return {
      opacity: o,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      borderWidth: 2,
      borderColor: THEME.accent,
      position: "absolute",
      left: CENTER_X - r,
      top: CENTER_Y - r,
    };
  });

  return (
    <FullscreenWrapper>
      {/* Background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: THEME.bg }]} />

      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <TouchableOpacity onPress={() => setSettingsOpen((v) => !v)} style={styles.gearBtn}>
          <Text style={styles.gearText}>⚙︎</Text>
        </TouchableOpacity>
      </View>

      {/* Main gesture canvas */}
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View pointerEvents="none" style={rippleStyle} />
          <Animated.View style={[styles.ballShell, shellStyle]}>
            <Svg width={BALL_DIAM} height={BALL_DIAM}>
              <Defs>
                <RadialGradient id="outerGlow" cx="50%" cy="40%" r="70%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.18} />
                  <Stop offset="55%" stopColor={THEME.accent} stopOpacity={0.10} />
                  <Stop offset="100%" stopColor="#000000" stopOpacity={0.06} />
                </RadialGradient>

                <RadialGradient id="liquidGrad" cx="40%" cy="40%" r="80%">
                  <Stop offset="0%" stopColor={THEME.calmGreen} stopOpacity={0.95} />
                  <Stop offset="80%" stopColor={THEME.calmBlue} stopOpacity={0.95} />
                </RadialGradient>

                <RadialGradient id="innerShadow" cx="50%" cy="50%" r="60%">
                  <Stop offset="0%" stopColor="#000000" stopOpacity={0.05} />
                  <Stop offset="100%" stopColor="#000000" stopOpacity={0.25} />
                </RadialGradient>
              </Defs>

              <Circle cx={BALL_RADIUS} cy={BALL_RADIUS} r={BALL_RADIUS * 0.995} fill="url(#outerGlow)" />
              <G>
                <Circle cx={BALL_RADIUS} cy={BALL_RADIUS} r={BALL_RADIUS * 0.86} fill="url(#liquidGrad)" />
              </G>
              <Circle cx={BALL_RADIUS} cy={BALL_RADIUS} r={BALL_RADIUS * 0.86} fill="url(#innerShadow)" opacity={0.15} />
              <Circle cx={BALL_RADIUS * 0.72} cy={BALL_RADIUS * 0.62} r={BALL_RADIUS * 0.18} fill="#FFFFFF" opacity={0.25} />
            </Svg>
          </Animated.View>

          <Animated.View
            style={[
              styles.coreDot,
              coreStyle,
              {
                width: BALL_DIAM * 0.86,
                height: BALL_DIAM * 0.86,
                borderRadius: (BALL_DIAM * 0.86) / 2,
                opacity: 0.12,
                backgroundColor: THEME.accent,
              },
            ]}
            pointerEvents="none"
          />

          {/* tiny bubble particles */}
          {particles.map((p, idx) => (
            <Particle key={idx} r={p.r} baseAngle={p.a} driftMs={p.drift} />
          ))}
        </View>
      </GestureDetector>

      {settingsOpen && (
        <View style={styles.tempSettingsToast}>
          <Text style={styles.toastText}>Settings coming soon…</Text>
        </View>
      )}
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  gearText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  ballShell: {
    position: "absolute",
    width: BALL_DIAM,
    height: BALL_DIAM,
    left: CENTER_X - BALL_RADIUS,
    top: CENTER_Y - BALL_RADIUS,
  },
  coreDot: { position: "absolute" },
  particle: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFFFFF",
  },
  tempSettingsToast: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  toastText: { color: "#fff", fontWeight: "700" },
});
