import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, useRootNavigationState } from "expo-router";

export default function IndexGate() {
  const root = useRootNavigationState();

  // Wait until the root navigator is mounted to avoid the “navigate before mounting” error.
  if (!root?.key) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1E3D" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href="/welcome" />;
}
