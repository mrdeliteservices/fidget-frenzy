import { Audio, AVPlaybackSource, AVPlaybackStatus } from "expo-av";
import type { AVPlaybackStatusToSet } from "expo-av/build/AV";

class SoundManager {
  private readonly map = new Map<string, Audio.Sound>();

  async play(
    id: string,
    src: AVPlaybackSource,
    opts: AVPlaybackStatusToSet = { shouldPlay: true }
  ) {
    await this.stop(id);
    const { sound } = await Audio.Sound.createAsync(src, opts);
    this.map.set(id, sound);

    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if ("didJustFinish" in status && status.didJustFinish) this.untrack(id);
    });

    return sound;
  }

  async stop(id: string) {
    const s = this.map.get(id);
    if (!s) return;
    try { await s.stopAsync(); } catch {}
    try { await s.unloadAsync(); } catch {}
    this.map.delete(id);
  }

  async stopAll() {
    const tasks = [...this.map.entries()].map(async ([id, s]) => {
      try { await s.stopAsync(); } catch {}
      try { await s.unloadAsync(); } catch {}
      this.map.delete(id);
    });
    await Promise.all(tasks);
  }

  private untrack(id: string) { this.map.delete(id); }
}

export const GlobalSoundManager = new SoundManager();
