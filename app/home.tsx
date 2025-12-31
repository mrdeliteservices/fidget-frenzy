// app/home.tsx
// Fidget Frenzy — Home Screen (Premium Frame + Sherbet Halo)
// ✅ Option A: World/stage hierarchy rebalance (Welcome → Home continuity)
// ✅ Minor polish: remove “banner” band + stage feels more designed
// ✅ Minor copy: consistent casing in subtitle
// ❌ No layout changes
// ❌ No carousel logic changes
// ❌ No animation changes
// ❌ No refactors

import React, { useEffect, useMemo, useState } from "react";
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

const { width: SCREEN_W } = Dimensions.get("window");

// Carousel spacing (unchanged)
const SPACING = 22;

// Fidget list (unchanged)
const fidgets = [
  {
    id: "1",
    name: "Fidget Spinner",
    route: "/screens/spinner",
    icon: require("../assets/icons/spinner.png"),
    accent: "#4DA3FF",
  },
  {
    id: "2",
    name: "Balloon Popper",
    route: "/screens/balloon-popper",
    icon: require("../assets/icons/balloon.png"),
    accent: "#FF8BCB",
  },
  {
    id: "3",
    name: "Stress Ball",
    route: "/screens/stress-ball",
    icon: require("../assets/icons/stressball.png"),
    accent: "#7BE495",
  },
  {
    id: "4",
    name: "Light Switch",
    route: "/screens/light-switch",
    icon: require("../assets/icons/light.png"),
    accent: "#FF7A3D",
  },
  {
    id: "5",
    name: "Odometer",
    route: "/screens/odometer",
    icon: require("../assets/icons/odometer.png"),
    accent: "#FFD88A",
  },
  {
    id: "6",
    name: "Gears",
    route: "/screens/gears",
    icon: require("../assets/icons/gears.png"),
    accent: "#C9C9C9",
  },
];

// ---------------- CARD (unchanged) ----------------
function FidgetCard({
  item,
  index,
  scrollX,
  intervalSV,
  cardWidth,
  onPress,
}: any) {
  const animatedStyle = useAnimatedStyle(() => {
    const interval = intervalSV.value;

    const inputRange = [
      (index - 1) * interval,
      index * interval,
      (index + 1) * interval,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.92, 1.08, 0.92],
      Extrapolate.CLAMP
    );
    const glow = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }],
      borderColor: `rgba(253,208,23,${0.18 + glow * 0.82})`,
      shadowOpacity: 0.12 + glow * 0.55,
    };
  });

  const haloStyle = { shadowColor: item.accent };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width: cardWidth, marginHorizontal: SPACING / 2 }}
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

  const [carouselW, setCarouselW] = useState(SCREEN_W);

  const { CARD_WIDTH, ITEM_INTERVAL, PADDING_H } = useMemo(() => {
    const w = Math.max(280, carouselW);
    const cardW = w * 0.62;
    const interval = cardW + SPACING;
    const pad = (w - cardW) / 2;
    return { CARD_WIDTH: cardW, ITEM_INTERVAL: interval, PADDING_H: pad };
  }, [carouselW]);

  const intervalSV = useSharedValue(ITEM_INTERVAL);
  useEffect(() => {
    intervalSV.value = ITEM_INTERVAL;
  }, [ITEM_INTERVAL]);

  useEffect(() => {
    (async () => {
      await Promise.allSettled([
        router.prefetch("/screens/spinner"),
        router.prefetch("/screens/balloon-popper"),
        router.prefetch("/screens/stress-ball"),
        router.prefetch("/screens/light-switch"),
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

  const progress = useDerivedValue(() => scrollX.value / intervalSV.value);

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
        {/* World (unchanged from Option A) */}
        <LinearGradient
          colors={["#8AC9FF", "#4F89C7", "#2A4E73"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Header (unchanged) */}
        <PremiumHeader
          left={<View />}
          center={<Text style={styles.headerTitle}>FIDGET FRENZY</Text>}
          right={
            <TouchableOpacity
              onPress={() => {}}
              style={[styles.settingsBtn, { opacity: 0.35 }]}
              activeOpacity={0.85}
            >
              <Ionicons
                name="settings-sharp"
                size={22}
                color={t.colors.textDark}
              />
            </TouchableOpacity>
          }
        />

        {/* Stage */}
        <View style={styles.stageWrap}>
          <PremiumStage>
            {/* Stage fill (UPDATED): 3-stop gradient to kill “banner” band */}
            <LinearGradient
              colors={[
                "rgba(10,28,52,0.58)", // top (slightly brighter, but not “label”)
                "rgba(8,24,46,0.74)",  // mid
                "rgba(6,18,34,0.86)",  // bottom
              ]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Stage “sheen” overlay (NEW): makes stage feel designed */}
            <LinearGradient
              colors={[
                "rgba(255,255,255,0.08)",
                "rgba(255,255,255,0.02)",
                "rgba(255,255,255,0.00)",
              ]}
              locations={[0, 0.25, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.stageHeader}>
              <Text style={styles.stageTitle}>Pick your Frenzy</Text>

              {/* Copy fix: consistent casing */}
              <Text style={styles.stageSub}>spin • tap • unwind your brain</Text>

              <View style={styles.stageLine} />
            </View>

            <View
              style={{ flex: 1, justifyContent: "center" }}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w && Math.abs(w - carouselW) > 2) setCarouselW(w);
              }}
            >
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
                    intervalSV={intervalSV}
                    cardWidth={CARD_WIDTH}
                    onPress={() => handleTap(item.route)}
                  />
                )}
              />
            </View>

            {/* Dots (unchanged) */}
            <View style={styles.dotsWrap}>
              {fidgets.map((_, i) => {
                const animatedDot = useAnimatedStyle(() => {
                  const diff = Math.abs(progress.value - i);
                  return {
                    transform: [
                      { scale: interpolate(diff, [0, 1], [1.6, 1]) },
                    ],
                    opacity: interpolate(diff, [0, 1], [1, 0.35]),
                    backgroundColor:
                      diff < 0.3
                        ? t.colors.accent
                        : "rgba(255,255,255,0.35)",
                  };
                });
                return <Animated.View key={i} style={[styles.dot, animatedDot]} />;
              })}
            </View>

            <Text style={styles.tagline}>
              Because everyone needs a little Frenzy
            </Text>
          </PremiumStage>
        </View>
      </SafeAreaView>
    </FullscreenWrapper>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1 },

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
