// app/home.tsx
// Fidget Frenzy — Home Screen (v0.9-dev CLEAN)
// Removed all debug logs + removed React interval polling
// Restored smooth Reanimated progress dots

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useDerivedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlobalSoundManager } from "../lib/soundManager";
import FullscreenWrapper from "../components/FullscreenWrapper";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.58;
const SPACING = 22;
const ITEM_INTERVAL = CARD_WIDTH + SPACING;
const PADDING_H = (width - CARD_WIDTH) / 2;

const BRAND = {
  blue: "#0B1E3D",
  gold: "#FDD017",
};

const fidgets = [
  { id: "1", name: "Fidget Spinner", route: "/screens/spinner-screen", icon: require("../assets/icons/spinner.png") },
  { id: "2", name: "Balloon Popper", route: "/screens/balloon-popper", icon: require("../assets/icons/balloon.png") },
  { id: "3", name: "Stress Ball", route: "/screens/stress-ball", icon: require("../assets/icons/stressball.png") },
  { id: "4", name: "Slider Switch", route: "/screens/slider-switch", icon: require("../assets/icons/slider.png") },
  { id: "5", name: "Odometer", route: "/screens/odometer", icon: require("../assets/icons/odometer.png") },
  { id: "6", name: "Gears", route: "/screens/gears", icon: require("../assets/icons/gears.png") },
];

// ---------------- CARD ----------------
function FidgetCard({ item, index, scrollX, onPress }: any) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * ITEM_INTERVAL,
      index * ITEM_INTERVAL,
      (index + 1) * ITEM_INTERVAL,
    ];

    const scale = interpolate(scrollX.value, inputRange, [0.9, 1.1, 0.9], Extrapolate.CLAMP);
    const glow = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolate.CLAMP);

    return {
      transform: [{ scale }],
      borderColor: `rgba(253,208,23,${glow})`,
      shadowOpacity: glow * 0.7,
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width: CARD_WIDTH, marginHorizontal: SPACING / 2 }}
    >
      <Animated.View style={[styles.card, animatedStyle]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardFill}
        >
          <Image source={item.icon} style={styles.icon} resizeMode="contain" />
          <Text style={styles.label}>{item.name}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------- MAIN ----------------
export default function Home() {
  const routerHook = useRouter();
  const scrollX = useSharedValue(0);
  const lastTap = useSharedValue(0);

  // Prefetch silently
  useEffect(() => {
    (async () => {
      await Promise.allSettled([
        router.prefetch("/screens/spinner-screen"),
        router.prefetch("/screens/balloon-popper"),
        router.prefetch("/screens/stress-ball"),
        router.prefetch("/screens/slider-switch"),
        router.prefetch("/screens/odometer"),
        router.prefetch("/screens/gears"),
      ]);
    })();

    return () => {
      GlobalSoundManager.stopAll();
    };
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Smooth progress for dots
  const progress = useDerivedValue(() => scrollX.value / ITEM_INTERVAL);

  const handleTap = async (route: string) => {
    const now = Date.now();
    if (now - lastTap.value < 250) return;
    lastTap.value = now;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    GlobalSoundManager.stopAll();
    routerHook.push(route);
  };

  return (
    <FullscreenWrapper>
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#09152E", BRAND.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={styles.headerWrap}>
          <Text style={styles.title}>FIDGET FRENZY</Text>
          <View style={styles.titleLine} />
        </View>

        {/* Carousel */}
        <Animated.FlatList
          data={fidgets}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_INTERVAL}
          decelerationRate="fast"
          bounces={false}
          contentContainerStyle={{
            paddingHorizontal: PADDING_H,
            alignItems: "center",
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => (
            <FidgetCard
              item={item}
              index={index}
              scrollX={scrollX}
              onPress={() => handleTap(item.route)}
            />
          )}
        />

        {/* Dots */}
        <View style={styles.dotsWrap}>
          {fidgets.map((_, i) => {
            const animatedDot = useAnimatedStyle(() => {
              const diff = Math.abs(progress.value - i);
              return {
                transform: [{ scale: interpolate(diff, [0, 1], [1.6, 1]) }],
                opacity: interpolate(diff, [0, 1], [1, 0.4]),
                backgroundColor:
                  diff < 0.3 ? BRAND.gold : "rgba(255,255,255,0.4)",
              };
            });
            return <Animated.View key={i} style={[styles.dot, animatedDot]} />;
          })}
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  headerWrap: { paddingTop: 8, paddingBottom: 12 },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.5,
  },
  titleLine: {
    alignSelf: "center",
    marginTop: 6,
    width: 160,
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(253,208,23,0.8)",
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    shadowColor: BRAND.gold,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  cardFill: {
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 155, height: 155 },
  label: {
    fontSize: 18,
    marginTop: 14,
    fontWeight: "700",
    color: BRAND.gold,
    letterSpacing: 0.5,
  },
  dotsWrap: {
    position: "absolute",
    bottom: 20,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
