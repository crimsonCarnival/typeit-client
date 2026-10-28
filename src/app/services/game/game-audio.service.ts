import { Injectable } from '@angular/core';

const KEY_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-single-key_wbesmp.mp3';
const TIME_UP_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-bell_xrpggk.mp3';
const ERROR_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240116/error-sound_kpstvo.mp3';

export type GameSound = 'key' | 'error' | 'timeUp';
export type SoundPack = 'typewriter' | 'click' | 'soft';

/** Synthesised tones for the packs that need no samples: [frequency Hz, duration s, gain, wave]. */
const SYNTH: Record<Exclude<SoundPack, 'typewriter'>, Record<GameSound, [number, number, number, OscillatorType]>> = {
  click: { key: [1800, 0.025, 0.25, 'square'], error: [220, 0.08, 0.25, 'square'], timeUp: [880, 0.35, 0.2, 'triangle'] },
  soft: { key: [520, 0.04, 0.12, 'sine'], error: [180, 0.12, 0.15, 'sine'], timeUp: [660, 0.5, 0.15, 'sine'] },
};

const loadAudioBuffer = async (audioContext: AudioContext, url: string): Promise<AudioBuffer | null> => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  }
};

/**
 * Typing sounds. The typewriter pack plays recorded samples (loaded once; a
 * sample that failed to load stays silent); the others are synthesised.
 */
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

  play(sound: GameSound, muted: boolean, pack: SoundPack = 'typewriter'): void {
    if (muted || !this.context) return;
    if (this.context.state === 'suspended') void this.context.resume();
    if (pack !== 'typewriter') {
      this.tone(...SYNTH[pack][sound]);
      return;
    }
    const buffer = this.buffers[sound];
    if (!buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0);
  }

  private tone(frequency: number, duration: number, gain: number, wave: OscillatorType): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
}
