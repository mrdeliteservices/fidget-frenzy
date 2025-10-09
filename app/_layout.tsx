import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        initialRouteName="index" // ← gate at /index, will redirect to /welcome safely
        screenOptions={{ headerShown: false, animation: "fade" }}
      />
    </GestureHandlerRootView>
  );
}
