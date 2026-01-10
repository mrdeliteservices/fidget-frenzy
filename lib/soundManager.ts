// lib/soundManager.ts
// Frenzy Apps — Global Sound Manager (v0.9-dev CLEAN)
// Expo SDK 54 — silent preload, safe playback, no console logs
// Shared across ALL mini-games

import { Audio, AVPlaybackSource, AVPlaybackStatus } from "expo-av";

/**
 * Universal Sound Manager for all Frenzy apps
 * Handles preloading, playback, looping, and cleanup
 */
class SoundManager {
  private readonly active = new Map<string, Audio.Sound>();

  // ✅ global enable/disable
  private enabled = true;

  /** Enable/disable all sound globally for the app */
  async setEnabled(v: boolean) {
    this.enabled = v;

    // ✅ IMPORTANT:
    // When disabling, DO NOT call expo-av stop/unload calls.
    // expo-av can throw "audio is not enabled" during shutdown / mode transitions,
    // causing uncaught promise crashes.
    if (!v) {
      // Just forget active handles; future play() calls are blocked by enabled flag.
      this.active.clear();
    }
  }

  /** Returns current sound enable state */
  isEnabled() {
    return this.enabled;
  }

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

  /** Pause without unloading */
  async pause(id: string) {
    const sound = this.active.get(id);
    if (!sound) return;

    try {
      await sound.pauseAsync();
    } catch {
      // silent
    }
  }

  /** Set volume on an active sound (0.0 - 1.0) */
  async setVolume(id: string, volume: number) {
    const sound = this.active.get(id);
    if (!sound) return;

    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
      }
    } catch {
      // silent
    }
  }

  /** Fade out then stop+unload (safe) */
  async fadeOutAndStop(id: string, durationMs: number = 450, steps: number = 10) {
    const sound = this.active.get(id);
    if (!sound) return;

    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        this.untrack(id);
        return;
      }

      const startVol = typeof status.volume === "number" ? status.volume : 1.0;

      const safeSteps = Math.max(3, Math.min(30, steps));
      const stepMs = Math.max(10, Math.floor(durationMs / safeSteps));

      for (let i = 1; i <= safeSteps; i++) {
        const v = startVol * (1 - i / safeSteps);
        try {
          await sound.setVolumeAsync(Math.max(0, v));
        } catch {
          // silent
        }
        await new Promise((res) => setTimeout(res, stepMs));
      }
    } catch {
      // silent
    }

    await this.stop(id);
  }

  /** Play a loop WITHOUT restarting if it already exists */
  async playLoopPersistent(id: string, src: AVPlaybackSource, volume: number = 1.0) {
    if (!this.enabled) return;

    try {
      const existing = this.active.get(id);

      if (existing) {
        const status = await existing.getStatusAsync();
        if (status.isLoaded) {
          await existing.setStatusAsync({ isLooping: true, volume });

          if (!status.isPlaying) {
            await existing.playAsync();
          }
          return;
        }
      }

      const { sound } = await Audio.Sound.createAsync(src, {
        shouldPlay: true,
        isLooping: true,
        volume,
      });

      this.active.set(id, sound);

      sound.setOnPlaybackStatusUpdate((_status: AVPlaybackStatus) => {
        // silent
      });
    } catch {
      // silent
    }
  }

  /** Play a sound effect or loop */
  async play(id: string, src: AVPlaybackSource, loop: boolean = false) {
    if (!this.enabled) return;

    try {
      await this.stop(id);

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
      // silent
    }
  }

  /** Stop and unload a specific sound (safe even if AV is disabled) */
  async stop(id: string) {
    const sound = this.active.get(id);
    if (!sound) return;

    try {
      await sound.stopAsync();
    } catch {
      // silent (covers "audio is not enabled")
    }

    try {
      await sound.unloadAsync();
    } catch {
      // silent
    }

    this.untrack(id);
  }

  /** Stop and unload ALL sounds (safe even if AV is disabled) */
  async stopAll() {
    const tasks = Array.from(this.active.entries()).map(async ([id, sound]) => {
      try {
        await sound.stopAsync();
      } catch {
        // silent
      }

      try {
        await sound.unloadAsync();
      } catch {
        // silent
      }

      this.untrack(id);
    });

    await Promise.all(tasks);
  }

  private untrack(id: string) {
    this.active.delete(id);
  }
}

export const GlobalSoundManager = new SoundManager();

export const setSoundEnabled = async (enabled: boolean) =>
  GlobalSoundManager.setEnabled(enabled);

export const isSoundEnabled = () => GlobalSoundManager.isEnabled();

export const playSound = async (
  id: string,
  src: AVPlaybackSource,
  loop: boolean = false
) => GlobalSoundManager.play(id, src, loop);

export const playLoopPersistent = async (
  id: string,
  src: AVPlaybackSource,
  volume: number = 1.0
) => GlobalSoundManager.playLoopPersistent(id, src, volume);

export const fadeOutAndStop = async (
  id: string,
  durationMs: number = 450,
  steps: number = 10
) => GlobalSoundManager.fadeOutAndStop(id, durationMs, steps);

export const setSoundVolume = async (id: string, volume: number) =>
  GlobalSoundManager.setVolume(id, volume);

export const preloadSounds = async (sounds: Record<string, AVPlaybackSource>) => {
  const tasks = Object.entries(sounds).map(async ([_, src]) => {
    try {
      const { sound } = await Audio.Sound.createAsync(src, {
        shouldPlay: false,
      });

      await sound.unloadAsync();
    } catch {
      // silent
    }
  });

  await Promise.all(tasks);
};
