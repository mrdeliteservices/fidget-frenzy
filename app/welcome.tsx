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

const { width: W, height: H } = Dimensions.get("window");

const TAP_SOUND = require("../assets/sounds/switch-click.mp3");

const TAGLINES = [
  "Find your focus",
  "Tap away your stress",
  "Relax. Tap. Repeat.",
  "Because everyone needs a little Frenzy",
];

const SUBLINE = "Created by MRD Elite Services";

export default function Welcome() {
  const router = useRouter();
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
      } catch (err) {
        console.warn("Sound load error:", err);
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
        // hold then fade out
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
  }, [index]);

  const handlePress = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
      if (soundRef.current) await soundRef.current.replayAsync();
    } catch (err) {
      console.warn("Play sound error:", err);
    }
    router.replace("/home");
  }, [router]);

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {/* Lighter “world” gradient so logo pops */}
      <LinearGradient
        colors={["#7BC6FF", "#1E4F86", "#081A34"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle glow behind logo (keeps it from getting lost) */}
      <View style={styles.logoGlow} pointerEvents="none" />

      <View style={styles.center}>
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
          <Text style={styles.tagline} numberOfLines={2}>
            {TAGLINES[index]}
          </Text>

          {/* De-emphasized (trust-building, not shouting) */}
          <Text style={styles.subline}>{SUBLINE}</Text>
        </Animated.View>

        {/* (Optional) tiny “tap to start” vibe without adding clutter */}
        <Text style={styles.hint}>Tap anywhere</Text>
      </View>
    </Pressable>
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
    minHeight: 72,
    marginTop: 22,
    paddingHorizontal: 6,
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
