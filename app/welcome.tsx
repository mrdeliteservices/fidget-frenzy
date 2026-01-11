import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";

import FullscreenWrapper, { useSettingsUI } from "../components/FullscreenWrapper";
import { BRAND_ATTRIBUTION_LINES } from "../constants/branding";
import { APP_IDENTITY } from "../constants/appIdentity";

const { width: W } = Dimensions.get("window");

const TAP_SOUND = require("../assets/sounds/switch-click.mp3");

const TAGLINES = [
  "Find your focus",
  "Tap away your stress",
  "Relax. Tap. Repeat.",
  "Because everyone needs a little Frenzy",
];

const HEADLINE_SLOT_HEIGHT = 72;

// Motion tuning (premium, not cartoon)
const IN_DURATION = 850;
const OUT_DURATION = 450;
const HOLD_MS = 1200;

// Per-line entrance "from" states
function getFromState(i: number) {
  // Keep values subtle. Big moves feel cheap fast.
  switch (i) {
    case 0: // from right
      return { x: Math.round(W * 0.28), y: 0, scale: 1 };
    case 1: // from distant background (depth)
      return { x: 0, y: 10, scale: 0.72 };
    case 2: // from left
      return { x: -Math.round(W * 0.28), y: 0, scale: 1 };
    case 3: // from bottom
      return { x: 0, y: 44, scale: 1 };
    default:
      return { x: 0, y: 20, scale: 1 };
  }
}

function WelcomeInner() {
  const router = useRouter();
  const { soundOn } = useSettingsUI(); // ✅ keep sound toggle behavior, no settings icon here

  const [index, setIndex] = useState(0);

  // Animated values
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const soundRef = useRef<Audio.Sound | null>(null);

  const isLast = index === TAGLINES.length - 1;

  const attributionText = useMemo(() => BRAND_ATTRIBUTION_LINES.join("\n"), []);

  // 🔊 preload sound
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(TAP_SOUND);
        if (mounted) soundRef.current = sound;
      } catch {
        // silent
      }
    })();

    return () => {
      mounted = false;
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  // ✨ tagline animation sequence (per-line entrance)
  useEffect(() => {
    const from = getFromState(index);

    // Reset to the correct "from" state
    opacity.setValue(0);
    translateX.setValue(from.x);
    translateY.setValue(from.y);
    scale.setValue(from.scale);

    const animateIn = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: IN_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: IN_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: IN_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: IN_DURATION,
        useNativeDriver: true,
      }),
    ]);

    const animateOut = Animated.timing(opacity, {
      toValue: 0,
      duration: OUT_DURATION,
      useNativeDriver: true,
    });

    const inHandle = animateIn.start(() => {
      const holdId = setTimeout(() => {
        animateOut.start(() => {
          if (index < TAGLINES.length - 1) {
            setIndex((prev) => prev + 1);
          } else {
            router.replace("/home");
          }
        });
      }, HOLD_MS);

      // Cleanup for hold timeout
      return () => clearTimeout(holdId);
    });

    return () => {
      // Stop any in-flight animation when index changes/unmounts
      opacity.stopAnimation();
      translateX.stopAnimation();
      translateY.stopAnimation();
      scale.stopAnimation();

      // inHandle is not reliably cancellable across platforms, but stopAnimation above is.
      // (No-op return)
      void inHandle;
    };
  }, [index, opacity, translateX, translateY, scale, router]);

  const handlePress = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
      if (soundOn && soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch {
      // silent
    }

    router.replace("/home");
  }, [router, soundOn]);

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <LinearGradient
        colors={["#7BC6FF", "#1E4F86", "#081A34"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.logoGlow} pointerEvents="none" />

      <View style={styles.center} pointerEvents="none">
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Animated.View
          style={[
            styles.taglineWrap,
            {
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            },
          ]}
        >
          <View style={styles.headlineSlot}>
            <Text style={styles.tagline} numberOfLines={2}>
              {TAGLINES[index]}
            </Text>
          </View>

          {/* Attribution: only screen 4. Slot is reserved so layout doesn't jump. */}
          <View style={styles.attributionSlot}>
            {isLast ? (
              <Text style={styles.subline}>{attributionText}</Text>
            ) : (
              <Text style={[styles.subline, styles.sublineHidden]}>
                {attributionText}
              </Text>
            )}
          </View>
        </Animated.View>

        <Text style={styles.hint}>Tap anywhere</Text>
      </View>
    </Pressable>
  );
}

export default function Welcome() {
  // When user hits Reset in Settings from Welcome, restart tagline cycle
  const [resetTick, setResetTick] = useState(0);

  const handleReset = useCallback(() => {
    setResetTick((v) => v + 1);
  }, []);

  return (
    <FullscreenWrapper appName={APP_IDENTITY.displayName} onReset={handleReset}>
      <WelcomeInner key={resetTick} />
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  logoGlow: {
    position: "absolute",
    left: "50%",
    top: "42%",
    width: W * 0.9,
    height: W * 0.9,
    marginLeft: -(W * 0.9) / 2,
    marginTop: -(W * 0.9) / 2,
    borderRadius: (W * 0.9) / 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    opacity: 0.35,
    transform: [{ scaleX: 1.1 }, { scaleY: 0.9 }],
  },

  logoWrap: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 210,
    height: 210,
  },

  taglineWrap: {
    marginTop: 22,
    paddingHorizontal: 6,
    alignItems: "center",
  },

  headlineSlot: {
    height: HEADLINE_SLOT_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },

  tagline: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  attributionSlot: {
    marginTop: 6,
    minHeight: 40, // reserve space so the UI doesn't shift when attribution appears
    justifyContent: "center",
    alignItems: "center",
  },

  subline: {
    color: "rgba(253,208,23,0.65)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  sublineHidden: {
    opacity: 0, // reserve layout without visual clutter
  },

  hint: {
    position: "absolute",
    bottom: 34,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "700",
    letterSpacing: 0.3,
    fontSize: 12,
  },
});
