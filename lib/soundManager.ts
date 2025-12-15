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

  /** ---------- NEW: status helpers (no refactor required) ---------- */

  /** Returns true if the sound exists, is loaded, and is currently playing */
  async isPlaying(id: string): Promise<boolean> {
    const sound = this.active.get(id);
    if (!sound) return false;

    try {
      const status = await sound.getStatusAsync();
      return !!(status.isLoaded && status.isPlaying);
    } catch {
      return false;
    }
  }

  /** Pause without unloading (useful for “engine running” style audio) */
  async pause(id: string) {
    const sound = this.active.get(id);
    if (!sound) return;

    try {
      await sound.pauseAsync();
    } catch {
      // silent
    }
  }

  /**
   * Play a loop WITHOUT restarting if it already exists.
   * - If already playing: do nothing
   * - If loaded but paused/stopped: resume
   * - If not created yet: create and start
   *
   * This is the key fix for Odometer engine audio.
   */
  async playLoopPersistent(id: string, src: AVPlaybackSource, volume: number = 1.0) {
    try {
      const existing = this.active.get(id);

      if (existing) {
        const status = await existing.getStatusAsync();
        if (status.isLoaded) {
          // ensure looping + volume, then resume if needed
          await existing.setStatusAsync({ isLooping: true, volume });

          if (!status.isPlaying) {
            await existing.playAsync();
          }
          return; // IMPORTANT: no restart
        }
      }

      // If no existing sound OR it wasn't loaded, create fresh
      const { sound } = await Audio.Sound.createAsync(src, {
        shouldPlay: true,
        isLooping: true,
        volume,
      });

      this.active.set(id, sound);

      // For loops, we intentionally do NOT untrack on finish (loops "finish" only on stop/unload)
      sound.setOnPlaybackStatusUpdate((_status: AVPlaybackStatus) => {
        // silent
      });
    } catch {
      // silent fail — no logs
    }
  }

  /** ---------- EXISTING API (unchanged behavior) ---------- */

  /** Play a sound effect or loop (ALWAYS restarts because it stop()s first) */
  async play(id: string, src: AVPlaybackSource, loop: boolean = false) {
    try {
      await this.stop(id); // ensure no duplicates (restarts sound)

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
    const tasks = Array.from(this.active.entries()).map(async ([id, sound]) => {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // silent
      }
      this.untrack(id);
    });

    await Promise.all(tasks);
  }

  /** Remove from active map */
  private untrack(id: string) {
    this.active.delete(id);
  }
}

/** Shared singleton instance */
export const GlobalSoundManager = new SoundManager();

/** Simple helper for quick playback (unchanged) */
export const playSound = async (
  id: string,
  src: AVPlaybackSource,
  loop: boolean = false
) => GlobalSoundManager.play(id, src, loop);

/** NEW helper for persistent loop playback */
export const playLoopPersistent = async (
  id: string,
  src: AVPlaybackSource,
  volume: number = 1.0
) => GlobalSoundManager.playLoopPersistent(id, src, volume);

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
