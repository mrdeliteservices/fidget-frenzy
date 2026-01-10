import React, { useRef, useEffect, useCallback, useState } from "react";
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

function WelcomeInner() {
  const router = useRouter();
  const { soundOn } = useSettingsUI(); // ✅ keep sound toggle behavior, no settings icon here

  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

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

  // ✨ tagline animation sequence
  useEffect(() => {
    const animate = () => {
      fadeAnim.setValue(0);
      translateY.setValue(20);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }).start(() => {
            if (index < TAGLINES.length - 1) {
              setIndex((prev) => prev + 1);
            } else {
              router.replace("/home");
            }
          });
        }, 1200);
      });
    };

    animate();
  }, [index, fadeAnim, translateY, router]);

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
              opacity: fadeAnim,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.headlineSlot}>
            <Text style={styles.tagline} numberOfLines={2}>
              {TAGLINES[index]}
            </Text>
          </View>

          <Text style={styles.subline}>{BRAND_ATTRIBUTION_LINES.join("\n")}</Text>
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
  subline: {
    color: "rgba(253,208,23,0.65)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    letterSpacing: 0.2,
    lineHeight: 18,
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
