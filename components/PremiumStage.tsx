// components/PremiumStage.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { frenzyTheme as t } from "../app/theme/frenzyTheme";

type Props = {
  style?: ViewStyle;
  children: React.ReactNode;

  // ✅ allow games to disable the top "shine" band
  showShine?: boolean;
};

export default function PremiumStage({
  style,
  children,
  showShine = true,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      {/* subtle “shine” (optional) — now a fade, not a hard bar */}
      {showShine ? (
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(255,255,255,0.10)", // top highlight
            "rgba(255,255,255,0.04)", // soften
            "rgba(255,255,255,0.00)", // disappear
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.shine}
        />
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: t.radii.stage,
    overflow: "hidden",

    // Keep a safe fallback so games without an inner gradient still look correct
    backgroundColor: t.colors.stageBottom,

    borderWidth: 1,
    borderColor: t.colors.stageStroke,
    ...t.shadow.stage,
  },

  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,

    // smaller + fades out = no more “label strip”
    height: 70,
  },
});
