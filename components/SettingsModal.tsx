// Fidget Frenzy – SettingsModal v0.9-dev unified
// Expo SDK 54 / RN 0.81
// Unified across all Frenzy modules (Stress Ball, Slider, Spinner, etc.)

import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
};

export default function SettingsModal({
  visible,
  onClose,
  onReset,
  soundOn,
  setSoundOn,
}: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Settings</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Sound</Text>
            <Switch
              value={soundOn}
              onValueChange={setSoundOn}
              thumbColor={soundOn ? "#FDD017" : "#999"}
              trackColor={{ true: "#FDD01744", false: "#333" }}
            />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.reset]} onPress={onReset}>
              <Text style={[styles.buttonText, { color: "#FDD017" }]}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.close]} onPress={onClose}>
              <Text style={[styles.buttonText, { color: "#fff" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    width: "80%",
    backgroundColor: "#0B1E3D",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    color: "#FDD017",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  label: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  reset: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FDD01788",
  },
  close: {
    backgroundColor: "#1C2A4A",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
