// app/index.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎮 Fidget Frenzy</Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/screens/spinner-screen")}
      >
        <Text style={styles.buttonText}>Play Spinner</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/screens/balloon-popper")}
      >
        <Text style={styles.buttonText}>Play Balloon Popper</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1220",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginVertical: 10,
    width: 220,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
});
