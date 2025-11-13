// Fidget Frenzy – Gears v0.9-dev unified
// Integrates SettingsModal, sound toggle, and Ionicons gear icon

import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
} from "react-native";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import FullscreenWrapper from "../../components/FullscreenWrapper";
import BackButton from "../../components/BackButton";
import SettingsModal from "../../components/SettingsModal";
import { playSound, preloadSounds } from "../../lib/soundManager";

const { width: W, height: H } = Dimensions.get("window");

// ---- Assets ----
const IMG = {
  gold: require("../../assets/gears/gear_gold_large.png"),
  silverL: require("../../assets/gears/gear_silver_large.png"),
  silverM: require("../../assets/gears/gear_silver_medium.png"),
  silverS: require("../../assets/gears/gear_silver_small.png"),
  gunS: require("../../assets/gears/gear_gunmetal_small.png"),
  darkS: require("../../assets/gears/gear_dark_small.png"),
  brightS: require("../../assets/gears/gear_bright_small.png"),
};

const GEAR_POOL = [
  IMG.silverL,
  IMG.silverM,
  IMG.silverS,
  IMG.gunS,
  IMG.darkS,
  IMG.brightS,
];

const SIZES = {
  GOLD: Math.min(W, H) * 0.42,
  L: Math.min(W, H) * 0.22,
  M: Math.min(W, H) * 0.18,
  S: Math.min(W, H) * 0.12,
  XS: Math.min(W, H) * 0.09,
};

// ---------- Gear Item ----------
function GearItem({ gear }: any) {
  const rot = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.Image
      source={gear.src}
      resizeMode="contain"
      style={[
        styles.gear,
        style,
        { left: gear.x, top: gear.y, width: gear.size, height: gear.size },
      ]}
    />
  );
}

// ---------- Main Screen ----------
export default function GearsScreen() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [power, setPower] = useState(0);

  const goldVelocity = useSharedValue(0);
  const prevAngleRef = useRef<number | null>(null);

  useEffect(() => {
    preloadSounds({
      gearClick: require("../../assets/sounds/gear-click.mp3"),
    });
  }, []);

  const playClick = () => {
    if (!soundOn) return;
    playSound("gearClick", require("../../assets/sounds/gear-click.mp3"));
  };

  const GOLD_BASE = {
    id: "gold",
    src: IMG.gold,
    x: W / 2 - SIZES.GOLD / 2,
    y: H * 0.74 - SIZES.GOLD / 2,
    size: SIZES.GOLD,
    r: SIZES.GOLD / 2,
    dir: 1,
  };

  // ---------- Static Layout ----------
  const gearLayout = useMemo(() => {
    const makeRing = (
      centerX: number,
      centerY: number,
      centerR: number,
      ringGap: number,
      count: number,
      sizePicker: () => number,
      startAngle = -Math.PI / 2
    ) => {
      const arr: any[] = [];
      for (let i = 0; i < count; i++) {
        const sz = sizePicker();
        const r = sz / 2;
        const distance = centerR + r - 2 + ringGap;
        const ang = startAngle + (i * (Math.PI * 2)) / count;
        const cx = centerX + Math.cos(ang) * distance;
        const cy = centerY + Math.sin(ang) * distance;
        if (
          cx + r < -20 ||
          cx - r > W + 20 ||
          cy + r < -20 ||
          cy - r > H + 20
        )
          continue;
        arr.push({
          id: `ring-${Math.random().toString(36).slice(2)}`,
          src: GEAR_POOL[Math.floor(Math.random() * GEAR_POOL.length)],
          x: cx - r,
          y: cy - r,
          size: sz,
          r,
          dir: -1,
        });
      }
      return arr;
    };

    const pickM = () => (Math.random() < 0.5 ? SIZES.M : SIZES.S);
    const pickS = () => (Math.random() < 0.6 ? SIZES.S : SIZES.XS);

    const ring1 = makeRing(
      GOLD_BASE.x + GOLD_BASE.r,
      GOLD_BASE.y + GOLD_BASE.r,
      GOLD_BASE.r,
      0,
      6,
      pickM
    );
    const ring2: any[] = [];
    for (const g of ring1) {
      const cx = g.x + g.r;
      const cy = g.y + g.r;
      ring2.push(
        ...makeRing(cx, cy, g.r, -2, 3, pickS, Math.random() * Math.PI * 2)
      );
    }

    return [GOLD_BASE, ...ring1, ...ring2];
  }, []);

  // ---------- Pan logic ----------
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, g) => {
          const GOLD = GOLD_BASE;
          const cx = GOLD.x + GOLD.r;
          const cy = GOLD.y + GOLD.r;
          const dx = g.x0 - cx;
          const dy = g.y0 - cy;
          const dist = Math.hypot(dx, dy);
          if (dist <= GOLD.r * 1.2) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            prevAngleRef.current = Math.atan2(dy, dx);
          } else {
            prevAngleRef.current = null;
          }
        },
        onPanResponderMove: (_, g) => {
          const GOLD = GOLD_BASE;
          if (prevAngleRef.current == null) return;
          const cx = GOLD.x + GOLD.r;
          const cy = GOLD.y + GOLD.r;
          const dx = g.moveX - cx;
          const dy = g.moveY - cy;
          const ang = Math.atan2(dy, dx);
          let delta = ang - prevAngleRef.current;
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          const deg = (delta * 180) / Math.PI;
          const GAIN = 260;
          goldVelocity.value += deg * GAIN;
          if (Math.abs(deg) > 0.6) playClick();
          prevAngleRef.current = ang;
        },
        onPanResponderRelease: () => {
          prevAngleRef.current = null;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [soundOn]
  );

  // ---------- Reset ----------
  const reset = () => {
    goldVelocity.value = 0;
    setPower(0);
  };

  return (
    <FullscreenWrapper>
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <TouchableOpacity onPress={() => setSettingsVisible(true)}>
            <Ionicons name="settings-sharp" size={30} color="#FDD017" />
          </TouchableOpacity>
        </View>

        {/* Power Display */}
        <View style={styles.powerWrap}>
          <Animated.Text style={styles.powerLabel}>POWER</Animated.Text>
          <Animated.Text style={styles.powerValue}>{power}</Animated.Text>
        </View>

        {/* Gears */}
        {gearLayout.map((gear) => (
          <GearItem key={gear.id} gear={gear} />
        ))}

        {/* Settings Modal */}
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onReset={reset}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
        />
      </View>
    </FullscreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  gear: { position: "absolute" },
  header: {
    position: "absolute",
    top: 28,
    left: 18,
    right: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 12,
    alignItems: "center",
  },
  powerWrap: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    alignItems: "center",
    zIndex: 10,
  },
  powerLabel: {
    color: "#FDD017",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1,
  },
  powerValue: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 42,
    lineHeight: 46,
  },
});
