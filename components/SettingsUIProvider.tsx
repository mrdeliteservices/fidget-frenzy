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

import SettingsModal from "./SettingsModal";
import { setSoundEnabled, GlobalSoundManager } from "../lib/soundManager";
import { APP_IDENTITY } from "../constants/appIdentity";

type RegisterArgs = {
  appName?: string;
  onReset?: () => void;
};

type SettingsUIContextValue = {
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

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

export default function SettingsUIProvider({ children }: Props) {
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [appName, setAppName] = useState<string>(APP_IDENTITY.displayName);
  const [onReset, setOnReset] = useState<(() => void) | undefined>(undefined);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const registerScreen = useCallback((args: RegisterArgs) => {
    if (args.appName) setAppName(args.appName);
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

  // ✅ Keep global sound manager in sync with toggle
  useEffect(() => {
    setSoundEnabled(soundOn).catch(() => {});
  }, [soundOn]);

  const handleReset = useCallback(() => {
    try {
      onReset?.();
    } finally {
      GlobalSoundManager.stopAll().catch(() => {});
    }
  }, [onReset]);

  const ctxValue = useMemo(
    () => ({
      soundOn,
      setSoundOn,
      settingsOpen,
      openSettings,
      closeSettings,
      registerScreen,
    }),
    [soundOn, settingsOpen, openSettings, closeSettings, registerScreen]
  );

  return (
    <SettingsUIContext.Provider value={ctxValue}>
      <View style={styles.container}>
        {children}

        {/* ✅ Modal only — NO floating SettingsButton overlay */}
        <SettingsModal
          visible={settingsOpen}
          onClose={closeSettings}
          onReset={handleReset}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          appName={appName}
        />
      </View>
    </SettingsUIContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
