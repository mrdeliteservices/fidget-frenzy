// components/PremiumStage.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { frenzyTheme as t } from "../app/theme/frenzyTheme";

type Props = {
  style?: ViewStyle;
  children: React.ReactNode;

  // ✅ NEW: allow games to disable the top "shine" band
  showShine?: boolean;
};

export default function PremiumStage({ style, children, showShine = true }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      {/* subtle “shine” (optional) */}
      {showShine ? <View pointerEvents="none" style={styles.shine} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: t.radii.stage,
    overflow: "hidden",
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
    height: 90,
    backgroundColor: t.colors.stageHighlight,
  },
});
