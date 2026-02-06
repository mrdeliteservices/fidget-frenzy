// components/SettingsUIProvider.tsx
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { View, StyleSheet } from "react-native";
import { Audio } from "expo-av";
// 🚨 DO NOT IMPORT expo-haptics ANYWHERE ELSE
// Screens must use the canonical haptic() helper below
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import SettingsModal from "./SettingsModal";
import { setSoundEnabled, GlobalSoundManager } from "../lib/soundManager";
import { APP_IDENTITY } from "../constants/appIdentity";

type RegisterArgs = {
  appName?: string;
  onReset?: () => void;
};

export type HapticKind =
  | "light"
  | "medium"
  | "heavy"
  | "rigid"
  | "soft"
  | "selection"
  | "success"
  | "warning"
  | "error";

type SettingsUIContextValue = {
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;

  hapticsOn: boolean;
  setHapticsOn: (v: boolean) => void;

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  // ✅ canonical helper — screens call this, never expo-haptics directly
  haptic: (kind?: HapticKind) => void;

  // Screen registration (appName + reset behavior)
  registerScreen: (args: RegisterArgs) => void;
};

const SettingsUIContext = createContext<SettingsUIContextValue | null>(null);

export function useSettingsUI() {
  const ctx = useContext(SettingsUIContext);
  if (!ctx) {
    throw new Error("useSettingsUI must be used inside <SettingsUIProvider>.");
  }
  return ctx;
}

type Props = {
  children: ReactNode;
};

const STORAGE_KEYS = {
  soundOn: "fidgetfrenzy.settings.soundOn",
  hapticsOn: "fidgetfrenzy.settings.hapticsOn",
} as const;

export default function SettingsUIProvider({ children }: Props) {
  const [soundOn, setSoundOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [appName, setAppName] = useState<string>(APP_IDENTITY.displayName);
  const [onReset, setOnReset] = useState<(() => void) | undefined>(undefined);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const registerScreen = useCallback((args: RegisterArgs) => {
    if (args.appName) setAppName(args.appName);

    // ✅ Critical: allow screens to *remove* reset by registering with onReset undefined
    setOnReset(() => args.onReset);
  }, []);

  // ✅ One-time Audio session setup (iOS silent switch friendliness)
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {
        // silent
      }
    })();
  }, []);

  // ✅ Load persisted settings once
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [s, h] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.soundOn),
          AsyncStorage.getItem(STORAGE_KEYS.hapticsOn),
        ]);

        if (cancelled) return;

        if (s === "0" || s === "1") setSoundOn(s === "1");
        if (h === "0" || h === "1") setHapticsOn(h === "1");
      } catch {
        // silent
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ Persist sound toggle + keep global sound manager in sync
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.soundOn, soundOn ? "1" : "0").catch(
      () => {}
    );
    setSoundEnabled(soundOn).catch(() => {});
  }, [soundOn]);

  // ✅ Persist haptics toggle
  useEffect(() => {
    AsyncStorage.setItem(
      STORAGE_KEYS.hapticsOn,
      hapticsOn ? "1" : "0"
    ).catch(() => {});
  }, [hapticsOn]);

  // ✅ Canonical haptic helper
  const haptic = useCallback(
    (kind: HapticKind = "medium") => {
      if (!hapticsOn) return;

      try {
        switch (kind) {
          case "selection":
            void Haptics.selectionAsync();
            return;

          case "success":
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            return;
          case "warning":
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
            return;
          case "error":
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error
            );
            return;

          case "light":
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            return;
          case "medium":
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            return;
          case "heavy":
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            return;
          case "rigid":
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            return;
          case "soft":
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
            return;

          default:
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch {
        // silent
      }
    },
    [hapticsOn]
  );

  // ✅ Reset (only when a screen registered one)
  const handleReset = useCallback(() => {
    try {
      onReset?.();
    } finally {
      GlobalSoundManager.stopAll().catch(() => {});
      closeSettings();
    }
  }, [onReset, closeSettings]);

  // ✅ Only show Reset if a screen actually registered onReset
  const modalOnReset = onReset ? handleReset : undefined;

  // ✅ Optional identity labels for SettingsModal (safe + defensive)
  const versionLabel = useMemo(() => {
    const anyId = APP_IDENTITY as any;
    const version =
      anyId?.version ??
      anyId?.appVersion ??
      anyId?.displayVersion ??
      anyId?.marketingVersion;
    const build = anyId?.build ?? anyId?.buildNumber ?? anyId?.iosBuild;

    if (typeof version === "string" && typeof build === "string") {
      return `${version} (${build})`;
    }
    if (typeof version === "string") return version;
    return undefined;
  }, []);

  const bundleIdLabel = useMemo(() => {
    const anyId = APP_IDENTITY as any;
    const bundle =
      anyId?.bundleId ??
      anyId?.iosBundleId ??
      anyId?.applicationId ??
      anyId?.id;
    return typeof bundle === "string" ? bundle : undefined;
  }, []);

  const ctxValue = useMemo(
    () => ({
      soundOn,
      setSoundOn,
      hapticsOn,
      setHapticsOn,
      settingsOpen,
      openSettings,
      closeSettings,
      haptic,
      registerScreen,
    }),
    [
      soundOn,
      hapticsOn,
      settingsOpen,
      openSettings,
      closeSettings,
      haptic,
      registerScreen,
    ]
  );

  return (
    <SettingsUIContext.Provider value={ctxValue}>
      <View style={styles.container}>
        {children}

        <SettingsModal
          visible={settingsOpen}
          onClose={closeSettings}
          onReset={modalOnReset}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          hapticsOn={hapticsOn}
          setHapticsOn={setHapticsOn}
          appName={appName}
          versionLabel={versionLabel}
          bundleIdLabel={bundleIdLabel}
          // ✅ NEW: “last tick” before turning haptics OFF (uses canonical helper)
          onHapticsWillDisable={() => haptic("selection")}
        />
      </View>
    </SettingsUIContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});