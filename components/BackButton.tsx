import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
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
        <Text style={styles.text}>‹ Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 60, // ✅ prevents layout shift in header alignment
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  text: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
    opacity: 0.9,
  },
});
