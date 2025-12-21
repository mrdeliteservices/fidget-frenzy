// app/home.tsx
// Fidget Frenzy — Home Screen (Premium Frame + Sherbet Halo)
// ✅ Light blue world background
// ✅ Premium stage container
// ✅ Unified header (PremiumHeader left/center/right props)
// ✅ Carousel + dots preserved
// ✅ Sherbet per-card halo glow
// ✅ No TS errors

import React, { useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";

import FullscreenWrapper from "../components/FullscreenWrapper";
import PremiumHeader from "../components/PremiumHeader";
import PremiumStage from "../components/PremiumStage";
import { frenzyTheme as t } from "./theme/frenzyTheme";
import { GlobalSoundManager } from "../lib/soundManager";

const { width } = Dimensions.get("window");

// Carousel geometry
const CARD_WIDTH = width * 0.62;
const SPACING = 22;
const ITEM_INTERVAL = CARD_WIDTH + SPACING;
const PADDING_H = (width - CARD_WIDTH) / 2;

// Sherbet accents (per game “world”)
const fidgets = [
  {
    id: "1",
    name: "Fidget Spinner",
    route: "/screens/spinner",
    icon: require("../assets/icons/spinner.png"),
    accent: "#4DA3FF", // bright blue
  },
  {
    id: "2",
    name: "Balloon Popper",
    route: "/screens/balloon-popper",
    icon: require("../assets/icons/balloon.png"),
    accent: "#FF8BCB", // pink
  },
  {
    id: "3",
    name: "Stress Ball",
    route: "/screens/stress-ball",
    icon: require("../assets/icons/stressball.png"),
    accent: "#7BE495", // mint
  },
  {
    id: "4",
    name: "Slider Switch",
    route: "/screens/slider-switch",
    icon: require("../assets/icons/slider.png"),
    accent: "#FF7A3D", // orange
  },
  {
    id: "5",
    name: "Odometer",
    route: "/screens/odometer",
    icon: require("../assets/icons/odometer.png"),
    accent: "#FFD88A", // warm amber (not candy)
  },
  {
    id: "6",
    name: "Gears",
    route: "/screens/gears",
    icon: require("../assets/icons/gears.png"),
    accent: "#C9C9C9", // steel
  },
];

// ---------------- CARD ----------------
function FidgetCard({ item, index, scrollX, onPress }: any) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * ITEM_INTERVAL,
      index * ITEM_INTERVAL,
      (index + 1) * ITEM_INTERVAL,
    ];

    const scale = interpolate(scrollX.value, inputRange, [0.92, 1.08, 0.92], Extrapolate.CLAMP);
    const glow = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolate.CLAMP);

    return {
      transform: [{ scale }],
      borderColor: `rgba(253,208,23,${0.18 + glow * 0.82})`,
      shadowOpacity: 0.12 + glow * 0.55,
    };
  });

  // halo color is per-card (shadowColor doesn't animate reliably cross-platform)
  const haloStyle = { shadowColor: item.accent };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width: CARD_WIDTH, marginHorizontal: SPACING / 2 }}
    >
      <Animated.View style={[styles.card, haloStyle, animatedStyle]}>
        <LinearGradient
          colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.03)"]}
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

  useEffect(() => {
    (async () => {
      await Promise.allSettled([
        router.prefetch("/screens/spinner"),
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
        {/* App "world" background */}
        <LinearGradient
          colors={[t.colors.appBgTop, t.colors.appBgBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <PremiumHeader
          left={<View />}
          center={<Text style={styles.headerTitle}>FIDGET FRENZY</Text>}
          right={
            <TouchableOpacity onPress={() => {}} style={styles.settingsBtn} activeOpacity={0.85}>
              <Ionicons name="settings-sharp" size={22} color={t.colors.textDark} />
            </TouchableOpacity>
          }
        />

        {/* Stage */}
        <View style={styles.stageWrap}>
          <PremiumStage>
            <LinearGradient
              colors={[t.colors.stageTop, t.colors.stageBottom]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.stageHeader}>
              <Text style={styles.stageTitle}>Pick your Frenzy</Text>
              <Text style={styles.stageSub}>Slide • tap • unwind your brain</Text>
              <View style={styles.stageLine} />
            </View>

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
                    opacity: interpolate(diff, [0, 1], [1, 0.35]),
                    backgroundColor: diff < 0.3 ? t.colors.accent : "rgba(255,255,255,0.35)",
                  };
                });
                return <Animated.View key={i} style={[styles.dot, animatedDot]} />;
              })}
            </View>

            <Text style={styles.tagline}>Because everyone needs a little Frenzy</Text>
          </PremiumStage>
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.appBgTop },

  headerTitle: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: t.colors.textDark,
  },
  settingsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },

  stageWrap: {
    flex: 1,
    paddingHorizontal: t.spacing.stageMarginH,
    paddingTop: t.spacing.stageMarginTop,
    paddingBottom: t.spacing.stageMarginBottom,
  },

  stageHeader: {
    paddingTop: 18,
    paddingBottom: 10,
    alignItems: "center",
  },
  stageTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  stageSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.2,
  },
  stageLine: {
    marginTop: 12,
    width: 160,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(253,208,23,0.85)",
  },

  card: {
    borderRadius: t.radii.card,
    padding: 18,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    // Shadows defined once to avoid TS duplicate warnings
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardFill: {
    borderRadius: t.radii.card - 2,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 155, height: 155 },
  label: {
    fontSize: 18,
    marginTop: 14,
    fontWeight: "800",
    color: t.colors.accent,
    letterSpacing: 0.4,
  },

  dotsWrap: {
    position: "absolute",
    bottom: 22,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  tagline: {
    position: "absolute",
    bottom: 56,
    width: "100%",
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontWeight: "800",
    letterSpacing: 0.2,
    fontSize: 12,
  },
});
