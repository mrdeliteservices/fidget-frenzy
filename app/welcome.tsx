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

const { width: W, height: H } = Dimensions.get("window");

const TAP_SOUND = require("../assets/sounds/switch-click.mp3");

const TAGLINES = [
  "Find your focus",
  "Tap away your stress.",
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
              // navigate after final tagline
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
          <Text style={styles.subline}>{SUBLINE}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081A34",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 240,
    height: 240, // fixed height prevents "jump"
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 200,
  },
  taglineWrap: {
    minHeight: 72,
    marginTop: 22,
    paddingHorizontal: 6,
  },
  tagline: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subline: {
    color: "#FDD017",
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
  },
});
