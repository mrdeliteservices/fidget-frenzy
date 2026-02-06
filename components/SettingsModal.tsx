// components/SettingsModal.tsx
import React, { useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  onReset?: () => void;

  soundOn: boolean;
  setSoundOn: (v: boolean) => void;

  hapticsOn: boolean;
  setHapticsOn: (v: boolean) => void;

  appName?: string;

  // Optional — if you choose to pass these later from appIdentity
  versionLabel?: string; // e.g. "1.0.3 (45)"
  bundleIdLabel?: string; // e.g. "com.mrdeliteservices.fidgetfrenzy"

  // ✅ NEW (polish): allows a final “tick” before turning haptics OFF
  // Provider will pass: () => haptic("selection")
  onHapticsWillDisable?: () => void;
};

export default function SettingsModal({
  visible,
  onClose,
  onReset,
  soundOn,
  setSoundOn,
  hapticsOn,
  setHapticsOn,
  appName,
  versionLabel,
  bundleIdLabel,
  onHapticsWillDisable,
}: Props) {
  const insets = useSafeAreaInsets();

  const title = "Settings";
  const productName = appName ?? "Fidget Frenzy";

  const handleHapticsChange = useCallback(
    (next: boolean) => {
      // If user is turning haptics OFF, give them one last confirmation “tick”
      // (tick happens while haptics are still ON)
      if (hapticsOn && !next) {
        try {
          onHapticsWillDisable?.();
        } catch {
          // silent
        }

        // Slight delay so the tick lands before we disable
        setTimeout(() => setHapticsOn(false), 40);
        return;
      }

      setHapticsOn(next);
    },
    [hapticsOn, onHapticsWillDisable, setHapticsOn]
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        {/* Tap outside closes */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Bottom sheet */}
        <View style={[styles.sheet, { paddingBottom: 14 + insets.bottom }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>

            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeIconBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          {/* ✅ Header divider (subtle) */}
          <View style={styles.headerDivider} />

          {/* SECTION: Feedback */}
          <Text style={styles.sectionLabel}>Feedback</Text>
          <View style={styles.card}>
            <SettingRow label="Sound" value={soundOn} onChange={setSoundOn} />
            <View style={styles.cardDivider} />
            <SettingRow
              label="Haptics"
              value={hapticsOn}
              onChange={handleHapticsChange}
            />
          </View>

          {/* SECTION: About */}
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            <InfoRow label="App" value={productName} />
            {!!versionLabel && (
              <>
                <View style={styles.cardDivider} />
                <InfoRow label="Version" value={versionLabel} />
              </>
            )}
            {!!bundleIdLabel && (
              <>
                <View style={styles.cardDivider} />
                <InfoRow label="Bundle" value={bundleIdLabel} isMonospace />
              </>
            )}
          </View>

          {/* Actions */}
          {!!onReset && (
            <Pressable
              onPress={onReset}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.resetBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reset app"
            >
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.doneBtn,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** ---------- Subcomponents (kept inside file for simplicity) ---------- */

function SettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function InfoRow({
  label,
  value,
  isMonospace,
}: {
  label: string;
  value: string;
  isMonospace?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, isMonospace && styles.mono]}
        numberOfLines={1}
        ellipsizeMode={label === "Bundle" ? "middle" : "tail"}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },

  sheet: {
    width: "100%",
    backgroundColor: "#F7F8FB",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,

    // Shadow (iOS) + elevation (Android)
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.2,
  },

  headerDivider: {
    height: 1,
    backgroundColor: "rgba(17,24,39,0.08)",
    marginBottom: 10,
  },

  closeIconBtn: {
    position: "absolute",
    right: 0,
    top: -2,
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.06)",
  },

  closeIcon: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 18,
  },

  // ✅ softened section label
  sectionLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(17,24,39,0.55)",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardDivider: {
    height: 1,
    backgroundColor: "rgba(17,24,39,0.08)",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },

  rowLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  infoLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },

  infoValue: {
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },

  mono: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 13,
    letterSpacing: 0.1,
  },

  actionBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  resetBtn: {
    // ✅ spacing/polish: looks intentional, not “danger slab”
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
  },

  resetText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.2,
  },

  doneBtn: {
    backgroundColor: "#111827",
  },

  doneText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});