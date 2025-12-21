// components/PremiumHeader.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { frenzyTheme as t } from "../app/theme/frenzyTheme";

type Props = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
};

export default function PremiumHeader({ left, center, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.slotLeft}>{left}</View>

      <View style={styles.centerPill}>
        {center}
      </View>

      <View style={styles.slotRight}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: t.spacing.screenPad,
    paddingTop: 6,
    paddingBottom: 6,
  },
  slotLeft: {
    width: 56,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  slotRight: {
    width: 56,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  centerPill: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: t.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.headerPill,
    borderWidth: 1,
    borderColor: t.colors.headerPillStroke,
    ...t.shadow.header,
  },
});
