// app/_layout.tsx
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";

import SettingsUIProvider from "../components/SettingsUIProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsUIProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
          }}
        />
      </SettingsUIProvider>
    </GestureHandlerRootView>
  );
}
