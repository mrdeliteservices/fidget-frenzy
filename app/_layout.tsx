// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      initialRouteName="index" // always land on Home (app/index.tsx)
      screenOptions={{ headerShown: false }}
    >
      {/* Home Menu */}
      <Stack.Screen name="index" />

      {/* Game screens (headers visible inside) */}
      <Stack.Screen name="spinner" options={{ title: "Fidget Spinner", headerShown: true }} />
      <Stack.Screen name="balloonpopper" options={{ title: "Balloon Popper", headerShown: true }} />
    </Stack>
  );
}
