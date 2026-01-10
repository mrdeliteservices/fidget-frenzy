// lib/soundManager.ts
// Fidget Frenzy — Global Sound Manager (SDK 54)
// ✅ Shell-standard API (setSoundEnabled / isSoundEnabled)
// ✅ SOUND POOLING for one-shot SFX (fixes random silent/tick in Expo Go)
// ✅ Loops remain single-instance persistent
// ✅ Silent + safe (no logs)

import { Audio, AVPlaybackSource, AVPlaybackStatus } from "expo-av";

const DEFAULT_SFX_POOL_SIZE = 4; // 3–6 is typical; 4 is the sweet spot

let audioModeReady: Promise<void> | null = null;

async function ensureAudioModeReady() {
  if (!audioModeReady) {
    audioModeReady = (async () => {
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
  }
  await audioModeReady;
}

type SfxPool = {
  src: AVPlaybackSource;
  sounds: Audio.Sound[];
  next: number;
  poolSize: number;
};

class SoundManager {
  private enabled = true;

  // One-shots use a pool per id
  private readonly sfxPools = new Map<string, SfxPool>();

  // Loops use one instance per id
  private readonly loops = new Map<string, Audio.Sound>();

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      // Stop everything immediately
      this.stopAll().catch(() => {});
    }
  }

  isEnabled() {
    return this.enabled;
  }

  /** ---------- One-shot pooling ---------- */

  private getOrCreatePool(id: string, src: AVPlaybackSource, poolSize = DEFAULT_SFX_POOL_SIZE) {
    const existing = this.sfxPools.get(id);
    if (existing) return existing;

    const pool: SfxPool = {
      src,
      sounds: new Array(poolSize).fill(null),
      next: 0,
      poolSize,
    } as any;

    this.sfxPools.set(id, pool);
    return pool;
  }

  private async ensurePoolSound(pool: SfxPool, index: number) {
    const current = pool.sounds[index];
    if (current) return current;

    try {
      const { sound } = await Audio.Sound.createAsync(pool.src, {
        shouldPlay: false,
        isLooping: false,
        volume: 1.0,
      });

      // Best-effort cleanup safety (we keep loaded for reliability)
      sound.setOnPlaybackStatusUpdate((_status: AVPlaybackStatus) => {});
      pool.sounds[index] = sound;
      return sound;
    } catch {
      return null;
    }
  }

  async play(id: string, src: AVPlaybackSource, loop: boolean = false) {
    if (!this.enabled) return;

    await ensureAudioModeReady();

    // Loops are handled separately
    if (loop) {
      await this.playLoopPersistent(id, src, 1.0);
      return;
    }

    // ✅ One-shot SFX: pooled playback
    const pool = this.getOrCreatePool(id, src, DEFAULT_SFX_POOL_SIZE);

    // If the src changes for the same id, reset the pool (rare, but safe)
    if (pool.src !== src) {
      await this.stop(id);
      pool.src = src;
    }

    const idx = pool.next;
    pool.next = (pool.next + 1) % pool.poolSize;

    const sound = await this.ensurePoolSound(pool, idx);
    if (!sound) return;

    try {
      // replayAsync is the most reliable "start now from 0"
      await sound.replayAsync();
    } catch {
      // If this instance got into a bad state, rebuild just this slot
      try {
        await sound.unloadAsync();
      } catch {}
      pool.sounds[idx] = null as any;

      const rebuilt = await this.ensurePoolSound(pool, idx);
      if (!rebuilt) return;

      try {
        await rebuilt.replayAsync();
      } catch {
        // silent
      }
    }
  }

  /** ---------- Loop playback ---------- */

  async playLoopPersistent(id: string, src: AVPlaybackSource, volume: number = 1.0) {
    if (!this.enabled) {
      await this.stop(id);
      return;
    }

    await ensureAudioModeReady();

    const existing = this.loops.get(id);
    if (existing) {
      try {
        await existing.setIsLoopingAsync(true);
        await existing.setVolumeAsync(volume);
        await existing.playAsync();
        return;
      } catch {
        try {
          await this.stop(id);
        } catch {}
      }
    }

    try {
      const { sound } = await Audio.Sound.createAsync(src, {
        shouldPlay: true,
        isLooping: true,
        volume,
      });
      this.loops.set(id, sound);
    } catch {
      // silent
    }
  }

  async setVolume(id: string, volume: number) {
    const loop = this.loops.get(id);
    if (!loop) return;

    try {
      await loop.setVolumeAsync(volume);
    } catch {
      // silent
    }
  }

  async fadeOutAndStop(id: string, durationMs: number = 450, steps: number = 10) {
    const loop = this.loops.get(id);
    if (!loop) {
      await this.stop(id);
      return;
    }

    try {
      const status = await loop.getStatusAsync();
      if (!("isLoaded" in status) || !status.isLoaded) {
        await this.stop(id);
        return;
      }

      const startVol = typeof status.volume === "number" ? status.volume : 1.0;

      for (let i = 0; i < steps; i++) {
        const v = startVol * (1 - (i + 1) / steps);
        try {
          await loop.setVolumeAsync(Math.max(0, v));
        } catch {}
        await new Promise((r) => setTimeout(r, Math.floor(durationMs / steps)));
      }
    } catch {
      // silent
    }

    await this.stop(id);
  }

  /** ---------- Stop / cleanup ---------- */

  async stop(id: string) {
    // Stop loop if exists
    const loop = this.loops.get(id);
    if (loop) {
      try {
        await loop.stopAsync();
      } catch {}
      try {
        await loop.unloadAsync();
      } catch {}
      this.loops.delete(id);
    }

    // Stop pooled SFX
    const pool = this.sfxPools.get(id);
    if (pool) {
      const sounds = pool.sounds.filter(Boolean) as Audio.Sound[];
      await Promise.all(
        sounds.map(async (s) => {
          try {
            await s.stopAsync();
          } catch {}
          try {
            await s.unloadAsync();
          } catch {}
        })
      );
      this.sfxPools.delete(id);
    }
  }

  async stopAll() {
    const loopIds = Array.from(this.loops.keys());
    const poolIds = Array.from(this.sfxPools.keys());
    await Promise.all([...loopIds, ...poolIds].map((id) => this.stop(id)));
  }

  /** ---------- Preload ---------- */

  // ✅ Preload: create pools for provided ids so first tap is never silent
  async preloadSounds(map: Record<string, AVPlaybackSource>, poolSize = DEFAULT_SFX_POOL_SIZE) {
    await ensureAudioModeReady();

    const entries = Object.entries(map);
    await Promise.all(
      entries.map(async ([id, src]) => {
        // Create pool + warm first slot
        const pool = this.getOrCreatePool(id, src, poolSize);
        await this.ensurePoolSound(pool, 0);
      })
    );
  }
}

export const GlobalSoundManager = new SoundManager();

// Required by SettingsUIProvider
export const setSoundEnabled = async (enabled: boolean) => {
  GlobalSoundManager.setEnabled(enabled);
};

export const isSoundEnabled = () => GlobalSoundManager.isEnabled();

// Helpers used across screens
export const playSound = async (id: string, src: AVPlaybackSource, loop: boolean = false) =>
  GlobalSoundManager.play(id, src, loop);

export const playLoopPersistent = async (id: string, src: AVPlaybackSource, volume: number = 1.0) =>
  GlobalSoundManager.playLoopPersistent(id, src, volume);

export const fadeOutAndStop = async (id: string, durationMs: number = 450, steps: number = 10) =>
  GlobalSoundManager.fadeOutAndStop(id, durationMs, steps);

export const setSoundVolume = async (id: string, volume: number) =>
  GlobalSoundManager.setVolume(id, volume);

export const preloadSounds = async (sounds: Record<string, AVPlaybackSource>) =>
  GlobalSoundManager.preloadSounds(sounds);
