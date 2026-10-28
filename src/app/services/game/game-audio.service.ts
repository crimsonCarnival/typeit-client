import { Injectable } from '@angular/core';

const KEY_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-single-key_wbesmp.mp3';
const TIME_UP_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-bell_xrpggk.mp3';
const ERROR_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240116/error-sound_kpstvo.mp3';

export type GameSound = 'key' | 'error' | 'timeUp';

const loadAudioBuffer = async (audioContext: AudioContext, url: string): Promise<AudioBuffer | null> => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  }
};

/** Typing sounds. Buffers load once; a sound that failed to load stays silent. */
@Injectable({ providedIn: 'root' })
export class GameAudioService {
  private readonly context: AudioContext | null = typeof AudioContext !== 'undefined' ? new AudioContext() : null;
  private readonly buffers: Partial<Record<GameSound, AudioBuffer | null>> = {};

  constructor() {
    const ctx = this.context;
    if (!ctx) return;
    void Promise.all([
      loadAudioBuffer(ctx, KEY_SOUND_URL),
      loadAudioBuffer(ctx, TIME_UP_SOUND_URL),
      loadAudioBuffer(ctx, ERROR_SOUND_URL),
    ]).then(([key, timeUp, error]) => {
      this.buffers.key = key;
      this.buffers.timeUp = timeUp;
      this.buffers.error = error;
    });
  }

  play(sound: GameSound, muted: boolean): void {
    const buffer = this.buffers[sound];
    if (muted || !buffer || !this.context) return;
    if (this.context.state === 'suspended') void this.context.resume();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0);
  }
}
