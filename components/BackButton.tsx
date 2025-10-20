import React from "react";
import { TouchableOpacity, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function BackButton() {
  const router = useRouter();

  const handlePress = () => {
    try {
      router.back();
    } catch (err) {
      console.warn("Back navigation failed:", err);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={handlePress}
        style={styles.button}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} // ✅ smoother tap zone
      >
        <Ionicons name="arrow-back" size={26} color="#C0C0C0" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 60, // ✅ keeps header alignment consistent
    alignItems: "flex-start",
    justifyContent: "center",
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
});
