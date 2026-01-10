// components/FullscreenWrapper.tsx
import React, { ReactNode, useEffect } from "react";
import { StatusBar, View, StyleSheet } from "react-native";

import { useSettingsUI } from "./SettingsUIProvider";
import { APP_IDENTITY } from "../constants/appIdentity";

type FullscreenWrapperProps = {
  children: ReactNode;
  appName?: string;
  onReset?: () => void;
};

/**
 * ✅ NOTE:
 * Settings + sound state is global in SettingsUIProvider (mounted in app/_layout.tsx).
 * FullscreenWrapper just registers per-screen appName + reset behavior.
 */
export default function FullscreenWrapper({
  children,
  appName = APP_IDENTITY.displayName,
  onReset,
}: FullscreenWrapperProps) {
  const { registerScreen } = useSettingsUI();

  useEffect(() => {
    registerScreen({ appName, onReset });
  }, [appName, onReset, registerScreen]);

  return (
    <View style={styles.container}>
      <StatusBar hidden animated />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

// ✅ Backward-compatible re-export so your existing imports keep working:
export { useSettingsUI } from "./SettingsUIProvider";

// ✅ If you ever want to use it directly elsewhere:
export { default as SettingsUIProvider } from "./SettingsUIProvider";
