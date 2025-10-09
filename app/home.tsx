import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { GlobalSoundManager } from "../lib/soundManager";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.55;
const SPACING = 20;
const BRAND = { blue: "#0B1E3D", purple: "#A249C0", gold: "#FDD017" };

const fidgets = [
  { id: "1", name: "Fidget Spinner", route: "/screens/spinner-screen", icon: require("../assets/icons/spinner.png") },
  { id: "2", name: "Balloon Popper", route: "/screens/balloon-popper", icon: require("../assets/icons/balloon.png") }, // ← correct label
  { id: "3", name: "Stress Ball", route: "/screens/stress-ball", icon: require("../assets/icons/stressball.png") },
  { id: "4", name: "Slider Switch", route: "/screens/slider-switch", icon: require("../assets/icons/slider.png") },
  { id: "5", name: "Odometer", route: "/screens/odometer", icon: require("../assets/icons/odometer.png") },
  { id: "6", name: "Gears", route: "/screens/gears", icon: require("../assets/icons/gears.png") },
];

export default function Home() { // ← DEFAULT EXPORT PRESENT
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      GlobalSoundManager.stopAll();
    };
  }, []);

  const click = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: BRAND.blue }]}>
      <Text style={styles.title}>FIDGET FRENZY</Text>

      <Animated.FlatList
        data={fidgets}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: (width - CARD_WIDTH) / 2,
          alignItems: "center",
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={click}
        renderItem={({ item, index }) => {
          const inputRange = [
            (index - 1) * (CARD_WIDTH + SPACING),
            index * (CARD_WIDTH + SPACING),
            (index + 1) * (CARD_WIDTH + SPACING),
          ];

          const scale = scrollX.interpolate({
            inputRange, outputRange: [0.9, 1.2, 0.9], extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange, outputRange: [0.6, 1, 0.6], extrapolate: "clamp",
          });
          const borderColor = scrollX.interpolate({
            inputRange, outputRange: ["transparent", BRAND.gold, "transparent"], extrapolate: "clamp",
          });
          const labelScale = scrollX.interpolate({
            inputRange, outputRange: [1, 1.15, 1], extrapolate: "clamp",
          });
          const labelColor = scrollX.interpolate({
            inputRange, outputRange: ["#FFF", BRAND.gold, "#FFF"], extrapolate: "clamp",
          });

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                GlobalSoundManager.stopAll();
                router.push(item.route);
              }}
              style={{ width: CARD_WIDTH, marginHorizontal: SPACING / 2 }}
            >
              <Animated.View
                style={[
                  styles.card,
                  {
                    transform: [{ scale }],
                    opacity,
                    borderColor,
                    shadowColor: BRAND.gold,
                    shadowOpacity: 0.7,
                    shadowRadius: 12,
                    elevation: 10,
                  },
                ]}
              >
                <Image source={item.icon} style={styles.icon} resizeMode="contain" />
                <Animated.Text
                  style={[
                    styles.label,
                    { transform: [{ scale: labelScale }], color: labelColor },
                  ]}
                >
                  {item.name}
                </Animated.Text>
              </Animated.View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.dots}>
        {fidgets.map((_, i) => {
          const inputRange = [
            (i - 1) * (CARD_WIDTH + SPACING),
            i * (CARD_WIDTH + SPACING),
            (i + 1) * (CARD_WIDTH + SPACING),
          ];
          const dotScale = scrollX.interpolate({
            inputRange, outputRange: [1, 1.5, 1], extrapolate: "clamp",
          });
          const dotColor = scrollX.interpolate({
            inputRange,
            outputRange: [
              "rgba(255,255,255,0.3)",
              BRAND.gold,
              "rgba(255,255,255,0.3)",
            ],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: dotColor, transform: [{ scale: dotScale }] },
              ]}
            />
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFF",
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 2,
  },
  icon: { width: 150, height: 150 },
  label: { fontSize: 18, marginTop: 15, fontWeight: "600" },
  dots: {
    position: "absolute",
    bottom: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 6 },
});
