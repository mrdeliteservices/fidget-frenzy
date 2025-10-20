import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

// ---------- Universal Base Palette ----------
const BASE = {
  steelDark: "#1A2233",
  steelMid: "#2B364C",
  steelLight: "#3D4E68",
  gold: "#FDD017",
  white: "#FFFFFF",
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  blurEnabled?: boolean;

  // ---------- Optional Overrides ----------
  accentColor?: string;          // replaces gold
  backgroundTint?: string;       // replaces steelMid
};

export default function SettingsModal({
  visible,
  onClose,
  onReset,
  soundOn,
  setSoundOn,
  blurEnabled = true,
  accentColor = BASE.gold,
  backgroundTint = BASE.steelMid,
}: Props) {
  const press = async (fn: () => void) => {
    try {
      await Haptics.selectionAsync();
    } catch {}
    fn();
  };

  const Content = () => (
    <View style={styles.wrapper}>
      {/* ✨ Subtle Ambient Glow */}
      <LinearGradient
        colors={[
          `${accentColor}30`,
          `${accentColor}10`,
          "transparent",
        ]}
        style={styles.glow}
      />

      {/* ⚙️ Main Box */}
      <View
        style={[
          styles.modalBox,
          { backgroundColor: `${backgroundTint}E6`, borderColor: accentColor },
        ]}
      >
        {/* 💫 Top Reflective Line */}
        <LinearGradient
          colors={[
            "rgba(255,255,255,0.1)",
            `${accentColor}70`,
            "rgba(255,255,255,0.05)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topSheen}
        />

        <Text style={[styles.title, { color: accentColor }]}>⚙️ SETTINGS</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => press(onReset)}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, { color: accentColor }]}>
            🔁 Reset Counter
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => press(() => setSoundOn(!soundOn))}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, { color: accentColor }]}>
            {soundOn ? "🔊 Sound: On" : "🔇 Sound: Off"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.closeButton]}
          onPress={() => press(onClose)}
          activeOpacity={0.85}
        >
          <Text style={styles.closeText}>❌ Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      {blurEnabled && Platform.OS !== "android" ? (
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.overlay}>
            <Content />
          </View>
        </BlurView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.darkOverlay]}>
          <Content />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  darkOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,15,25,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  glow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    alignSelf: "center",
    top: "40%",
  },
  modalBox: {
    width: "85%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    shadowColor: BASE.gold,
    shadowOpacity: 0.35,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 6 },
    overflow: "hidden",
  },
  topSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 22,
    letterSpacing: 1.2,
  },
  button: {
    backgroundColor: BASE.steelLight,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 6,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: BASE.steelDark,
  },
  closeText: {
    color: BASE.white,
    fontSize: 17,
    fontWeight: "600",
  },
});
