// app/home.tsx
// Fidget Frenzy — Home Screen (Premium Frame + Sherbet Halo)
// ✅ Shell-standard wiring: Settings icon works (useSettingsUI) + useCallback
// ✅ Keeps ALL 6 games (FULL PRODUCT)
// ✅ No carousel layout/animation changes
// ✅ Bug Fix: single-tap entry responsiveness + stronger haptics
// ✅ Layout Fix: restore centered snap with peeking neighbors using snapToOffsets

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import FullscreenWrapper, { useSettingsUI } from "../components/FullscreenWrapper";
import PremiumHeader from "../components/PremiumHeader";
import PremiumStage from "../components/PremiumStage";
import { frenzyTheme as t } from "./theme/frenzyTheme";
import { GlobalSoundManager } from "../lib/soundManager";
import { APP_IDENTITY } from "../constants/appIdentity";

const { width: SCREEN_W } = Dimensions.get("window");

// Carousel spacing (unchanged)
const SPACING = 22;

// FULL PRODUCT: all fidgets remain
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
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

function HomeInner() {
  const routerHook = useRouter();
  const { openSettings } = useSettingsUI();

  const scrollX = useSharedValue(0);

  // Tap debounce
  const lastTapRef = useRef(0);

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
  }, [ITEM_INTERVAL, intervalSV]);

  // ✅ Explicit snap offsets (restores centered snap + peeking neighbors)
  const snapOffsets = useMemo(() => {
    return fidgets.map((_, i) => i * ITEM_INTERVAL);
  }, [ITEM_INTERVAL]);

  useEffect(() => {
    (async () => {
      // Prefetch all routes (FULL PRODUCT)
      await Promise.allSettled(
        [
          routerHook.prefetch?.("/screens/spinner"),
          routerHook.prefetch?.("/screens/balloon-popper"),
          routerHook.prefetch?.("/screens/stress-ball"),
          routerHook.prefetch?.("/screens/light-switch"),
          routerHook.prefetch?.("/screens/odometer"),
          routerHook.prefetch?.("/screens/gears"),
        ].filter(Boolean) as any
      );
    })();

    return () => {
      GlobalSoundManager.stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const progress = useDerivedValue(() => scrollX.value / intervalSV.value);

  // ✅ Single-tap entry feel:
  // - Navigate immediately
  // - Fire stronger haptics after (do not await)
  const handleTap = useCallback(
    (route: string) => {
      const now = Date.now();
      if (now - lastTapRef.current < 250) return;
      lastTapRef.current = now;

      GlobalSoundManager.stopAll();
      routerHook.push(route);

      // More pronounced haptic
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    },
    [routerHook]
  );

  const handleOpenSettings = useCallback(() => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    openSettings();
  }, [openSettings]);

  return (
    <SafeAreaView style={styles.container}>
      {/* World (unchanged) */}
      <LinearGradient
        colors={["#8AC9FF", "#4F89C7", "#2A4E73"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <PremiumHeader
        left={<View />}
        center={
          <Text style={styles.headerTitle}>
            {APP_IDENTITY.displayName.toUpperCase()}
          </Text>
        }
        right={
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={styles.settingsBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          <LinearGradient
            colors={[
              "rgba(10,28,52,0.58)",
              "rgba(8,24,46,0.74)",
              "rgba(6,18,34,0.86)",
            ]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

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

              // ✅ Restore centered snap behavior
              snapToOffsets={snapOffsets}
              snapToAlignment="start"

              decelerationRate="fast"
              bounces={false}

              // ✅ Keeps the better tap feel while still snapping correctly
              disableIntervalMomentum

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

          <View style={styles.dotsWrap}>
            {fidgets.map((_, i) => {
              const animatedDot = useAnimatedStyle(() => {
                const diff = Math.abs(progress.value - i);
                return {
                  transform: [{ scale: interpolate(diff, [0, 1], [1.6, 1]) }],
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
  );
}

export default function Home() {
  const handleReset = useCallback(() => {
    GlobalSoundManager.stopAll();
  }, []);

  return (
    <FullscreenWrapper appName={APP_IDENTITY.displayName} onReset={handleReset}>
      <HomeInner />
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
    opacity: 1,
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
