import React, { ReactNode } from "react";
import { StatusBar, View, StyleSheet } from "react-native";

type FullscreenWrapperProps = {
  children: ReactNode;
};

export default function FullscreenWrapper({ children }: FullscreenWrapperProps) {
  return (
    <View style={styles.container}>
      {/* Hide status bar globally for this screen */}
      <StatusBar hidden={true} animated={true} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
