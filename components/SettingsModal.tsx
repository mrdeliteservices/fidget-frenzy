// SettingsModal — unified + reusable across Frenzy shells
// Expo SDK 54 / RN 0.81

import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import Constants from "expo-constants";
import { BRAND_ATTRIBUTION } from "../constants/branding";
import { APP_IDENTITY } from "../constants/appIdentity";

type Props = {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;

  // New: allow each shell to override its display name cleanly.
  // If not provided, defaults to Frenzy Apps.
  appName?: string;
};

function getVersionBestEffort(): string {
  const anyConstants: any = Constants;

  const version =
    anyConstants?.expoConfig?.version ||
    anyConstants?.manifest?.version ||
    anyConstants?.manifest2?.extra?.expoClient?.version;

  const iosBuild = anyConstants?.expoConfig?.ios?.buildNumber;
  const androidBuild = anyConstants?.expoConfig?.android?.versionCode;

  const build = iosBuild ?? androidBuild;

  if (version && build != null) return `${version} (${build})`;
  if (version) return String(version);
  return "—";
}

export default function SettingsModal({
  visible,
  onClose,
  onReset,
  soundOn,
  setSoundOn,
  appName = APP_IDENTITY.displayName,
}: Props) {
  const version = useMemo(() => getVersionBestEffort(), []);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Settings</Text>

          {/* App / Version / Attribution (LOCKED requirement) */}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>App</Text>
            <Text style={styles.metaValue}>{appName}</Text>

            <Text style={[styles.metaLabel, { marginTop: 10 }]}>Version</Text>
            <Text style={styles.metaValue}>{version}</Text>

            <Text style={[styles.metaLabel, { marginTop: 10 }]}>Attribution</Text>
            <Text style={styles.metaValue}>{BRAND_ATTRIBUTION}</Text>
          </View>

          {/* Existing controls */}
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
            <TouchableOpacity
              style={[styles.button, styles.reset]}
              onPress={onReset}
              accessibilityRole="button"
              accessibilityLabel="Reset"
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonText, { color: "#FDD017" }]}>
                Reset
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.close]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close Settings"
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>
                Close
              </Text>
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
    width: "84%",
    backgroundColor: "#0B1E3D",
    borderRadius: 20,
    padding: 22,
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
    marginBottom: 16,
  },

  metaBlock: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 18,
  },
  metaLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metaValue: {
    marginTop: 6,
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
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
