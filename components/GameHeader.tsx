// components/GameHeader.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  left?: React.ReactNode;                 // e.g., <BackButton />
  centerLabel: string;                    // e.g., "Clicks:"
  centerValue: string | number;           // e.g., 12
  onPressSettings: () => void;
  style?: ViewStyle;

  // optional polish hooks (not required day-1)
  settingsIconColor?: string;             // default matches Slider
  pillVariant?: "dark" | "light";         // default "dark"
};

export default function GameHeader({
  left,
  centerLabel,
  centerValue,
  onPressSettings,
  style,
  settingsIconColor = "#C0C0C0",
  pillVariant = "dark",
}: Props) {
  const pillBg =
    pillVariant === "light" ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.28)";

  return (
    <View style={[styles.topBar, style]}>
      <View style={styles.leftSlot}>{left}</View>

      <View style={[styles.counterPill, { backgroundColor: pillBg }]}>
        <Text style={styles.counterLabel}>{centerLabel}</Text>
        <Text style={styles.counterTxt}>{centerValue}</Text>
      </View>

      <TouchableOpacity onPress={onPressSettings} style={styles.settingsBtn}>
        <Ionicons name="settings-sharp" size={26} color={settingsIconColor} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 4,
  },

  // Keeps the pill truly centered even if left/right widths differ
  leftSlot: {
    minWidth: 44,
    alignItems: "flex-start",
  },

  settingsBtn: {
    minWidth: 44,
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  counterPill: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 64,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",

    // subtle “chamber” polish (safe on all worlds)
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  counterLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginRight: 4,
  },

  counterTxt: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
