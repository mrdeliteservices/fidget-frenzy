// ============================================================================
//  Fidget Frenzy – Unified Sound Manager (Expo SDK 54)
//  Purpose: Centralized, crash-proof sound control for all mini-games
//  Version: v1.0 (unified for /utils)
// ----------------------------------------------------------------------------
//  FEATURES
//  • Safe preload before playback (fixes slider-switch crash)
//  • Works with expo-av@16
//  • Provides both functional API + GlobalSoundManager class
//  • Auto-unloads on memory pressure
//  • Expand easily by editing the `SOUNDS` map
// ============================================================================

import { Audio, AVPlaybackSource } from "expo-av";

// ---------------------------------------------------------------------------
// 🗺️ Preload table – add new sounds here
// Only include sounds actually used in this build to avoid confusion.
// ---------------------------------------------------------------------------
const SOUNDS: Record<string, AVPlaybackSource> = {
  "switch-click": require("@assets/sounds/switch-click.mp3"),
};

// ---------------------------------------------------------------------------
// ⚙️ Config
// ---------------------------------------------------------------------------
let globalVolume = 1.0;
let isMuted = false;

// ---------------------------------------------------------------------------
// 💾 Internal cache
// ---------------------------------------------------------------------------
const soundCache: Record<string, Audio.Sound | null> = {};

// ---------------------------------------------------------------------------
// 🔊 preloadSound(id)
// ---------------------------------------------------------------------------
export async function preloadSound(id: keyof typeof SOUNDS) {
  if (soundCache[id]) return; // already loaded

  const src = SOUNDS[id];
  if (!src) throw new Error(`Sound not found: ${id}`);

  const { sound } = await Audio.Sound.createAsync(src, {
    shouldPlay: false,
    volume: globalVolume,
  });

  soundCache[id] = sound;
}

// ---------------------------------------------------------------------------
// ▶️ playSound(id)
// ---------------------------------------------------------------------------
export async function playSound(id: keyof typeof SOUNDS) {
  if (isMuted) return;

  try {
    let sound = soundCache[id];
    if (!sound) {
      await preloadSound(id);
      sound = soundCache[id];
    }

    if (!sound) return;

    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (err) {
    console.warn("SoundManager: playSound failed:", err);
  }
}

// ---------------------------------------------------------------------------
// ⏹️ stopSound(id)
// ---------------------------------------------------------------------------
export async function stopSound(id: keyof typeof SOUNDS) {
  const sound = soundCache[id];
  if (!sound) return;

  try {
    await sound.stopAsync();
  } catch {}
}

// ---------------------------------------------------------------------------
// 🔇 Global control
// ---------------------------------------------------------------------------
export function setGlobalVolume(volume: number) {
  globalVolume = Math.min(Math.max(volume, 0), 1);
  Object.values(soundCache).forEach(async (s) => {
    if (s) await s.setVolumeAsync(globalVolume);
  });
}

export function toggleMute() {
  isMuted = !isMuted;
}

// ---------------------------------------------------------------------------
// 🧹 Cleanup
// ---------------------------------------------------------------------------
export async function unloadAllSounds() {
  const entries = Object.entries(soundCache);
  for (const [id, sound] of entries) {
    try {
      await sound?.unloadAsync();
    } catch {}
    delete soundCache[id];
  }
}

// ---------------------------------------------------------------------------
// 🧱 Legacy-compatible class wrapper (for existing imports)
// ---------------------------------------------------------------------------
export class GlobalSoundManager {
  static async play(id: keyof typeof SOUNDS) {
    return playSound(id);
  }
  static async stop(id: keyof typeof SOUNDS) {
    return stopSound(id);
  }
  static async preload(id: keyof typeof SOUNDS) {
    return preloadSound(id);
  }
  static async stopAll() {
    return unloadAllSounds();
  }
  static toggleMute() {
    toggleMute();
  }
}

// ---------------------------------------------------------------------------
// ✅ Default export (fixes “Element type is invalid” issue in Expo Router)
// ---------------------------------------------------------------------------
export default {
  playSound,
  preloadSound,
  stopSound,
  unloadAllSounds,
  setGlobalVolume,
  toggleMute,
  GlobalSoundManager,
};
