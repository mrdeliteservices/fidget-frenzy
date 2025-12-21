// components/SettingsButton.tsx
import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";

type Props = {
  onPress: () => void;
  style?: ViewStyle;
};

export default function SettingsButton({ onPress, style }: Props) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, style]}>
      <Text style={styles.icon}>⚙️</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 6,
  },
  icon: {
    fontSize: 24,
    color: "#FDD017",
  },
});
