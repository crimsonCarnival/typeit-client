import { Injectable } from '@angular/core';

const KEY_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-single-key_wbesmp.mp3';
const TIME_UP_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240117/typewriter-bell_xrpggk.mp3';
const ERROR_SOUND_URL = 'https://res.cloudinary.com/dzjid2tos/video/upload/v1770240116/error-sound_kpstvo.mp3';

export type GameSound = 'key' | 'error' | 'timeUp';
export type SoundPack = 'typewriter' | 'click' | 'soft' | 'beep' | 'pop' | 'sine' | 'square' | 'triangle' | 'sawtooth';

/** Synthesised tones for the packs that need no samples: [frequency Hz, duration s, gain, wave]. */
const SYNTH: Record<Exclude<SoundPack, 'typewriter'>, Record<GameSound, [number, number, number, OscillatorType]>> = {
  click: { key: [1800, 0.025, 0.25, 'square'], error: [220, 0.08, 0.25, 'square'], timeUp: [880, 0.35, 0.2, 'triangle'] },
  soft: { key: [520, 0.04, 0.12, 'sine'], error: [180, 0.12, 0.15, 'sine'], timeUp: [660, 0.5, 0.15, 'sine'] },
  beep: { key: [1000, 0.03, 0.15, 'square'], error: [300, 0.1, 0.2, 'square'], timeUp: [1200, 0.3, 0.15, 'square'] },
  pop: { key: [380, 0.03, 0.3, 'sine'], error: [140, 0.08, 0.3, 'sine'], timeUp: [520, 0.3, 0.2, 'sine'] },
  sine: { key: [660, 0.05, 0.18, 'sine'], error: [220, 0.12, 0.2, 'sine'], timeUp: [880, 0.4, 0.15, 'sine'] },
  square: { key: [440, 0.04, 0.1, 'square'], error: [160, 0.1, 0.15, 'square'], timeUp: [660, 0.35, 0.1, 'square'] },
  triangle: { key: [550, 0.05, 0.25, 'triangle'], error: [200, 0.1, 0.25, 'triangle'], timeUp: [770, 0.4, 0.2, 'triangle'] },
  sawtooth: { key: [330, 0.04, 0.08, 'sawtooth'], error: [110, 0.1, 0.12, 'sawtooth'], timeUp: [495, 0.35, 0.08, 'sawtooth'] },
};

/** Room cues: two quick notes, rising when someone joins and falling when they leave. [Hz, start s] */
export type RoomCue = 'join' | 'leave';
const CUES: Record<RoomCue, [number, number][]> = {
  join: [[520, 0], [780, 0.09]],
  leave: [[520, 0], [340, 0.09]],
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

  play(sound: GameSound, muted: boolean, pack: SoundPack = 'typewriter', volume = 1): void {
    if (muted || !this.context) return;
    if (this.context.state === 'suspended') void this.context.resume();
    if (pack !== 'typewriter') {
      const [frequency, duration, gain, wave] = SYNTH[pack][sound];
      this.tone(frequency, duration, gain * volume, wave);
      return;
    }
    const buffer = this.buffers[sound];
    if (!buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const amp = this.context.createGain();
    amp.gain.value = volume;
    source.connect(amp).connect(this.context.destination);
    source.start(0);
  }

  /** A short double beep: the time-left warning in timed tests. */
  playWarning(muted: boolean, volume = 1): void {
    if (muted || !this.context) return;
    if (this.context.state === 'suspended') void this.context.resume();
    this.tone(990, 0.09, 0.2 * volume, 'square');
    this.tone(990, 0.09, 0.2 * volume, 'square', 0.14);
  }

  /** Join/leave cue for a race room; the same notes in every sound pack. */
  playCue(cue: RoomCue, muted: boolean): void {
    if (muted || !this.context) return;
    if (this.context.state === 'suspended') void this.context.resume();
    for (const [frequency, at] of CUES[cue]) this.tone(frequency, 0.14, 0.14, 'sine', at);
  }

  private tone(frequency: number, duration: number, gain: number, wave: OscillatorType, delay = 0): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = frequency;
    const start = ctx.currentTime + delay;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }
}
