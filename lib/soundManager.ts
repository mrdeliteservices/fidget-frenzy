// lib/soundManager.ts
// Fidget Frenzy — Global Sound Manager (v0.9-dev CLEAN)
// Expo SDK 54 — silent preload, safe playback, no console logs
// Shared across ALL mini-games

import { Audio, AVPlaybackSource, AVPlaybackStatus } from "expo-av";

/**
 * Universal Sound Manager for all Frenzy apps
 * Handles preloading, playback, looping, and cleanup
 */
class SoundManager {
  private readonly active = new Map<string, Audio.Sound>();

  /** Play a sound effect or loop */
  async play(id: string, src: AVPlaybackSource, loop: boolean = false) {
    try {
      await this.stop(id); // ensure no duplicates

      const { sound } = await Audio.Sound.createAsync(src, {
        shouldPlay: true,
        isLooping: loop,
        volume: 1.0,
      });

      this.active.set(id, sound);

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if ("didJustFinish" in status && status.didJustFinish && !loop) {
          this.untrack(id);
        }
      });
    } catch {
      // silent fail — no logs
    }
  }

  /** Stop and unload a specific sound */
  async stop(id: string) {
    const sound = this.active.get(id);
    if (!sound) return;

    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      // silent
    }

    this.untrack(id);
  }

  /** Stop and unload ALL sounds */
  async stopAll() {
    const tasks = Array.from(this.active.entries()).map(
      async ([id, sound]) => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch {
          // silent
        }
        this.untrack(id);
      }
    );

    await Promise.all(tasks);
  }

  /** Remove from active map */
  private untrack(id: string) {
    this.active.delete(id);
  }
}

/** Shared singleton instance */
export const GlobalSoundManager = new SoundManager();

/** Simple helper for quick playback */
export const playSound = async (
  id: string,
  src: AVPlaybackSource,
  loop: boolean = false
) => GlobalSoundManager.play(id, src, loop);

/** Silent preload — no logs EVER */
export const preloadSounds = async (sounds: Record<string, AVPlaybackSource>) => {
  const tasks = Object.entries(sounds).map(async ([_, src]) => {
    try {
      const { sound } = await Audio.Sound.createAsync(src, {
        shouldPlay: false,
      });

      // Immediately unload — we want preload in memory, not active
      await sound.unloadAsync();
    } catch {
      // silent
    }
  });

  await Promise.all(tasks);
};
