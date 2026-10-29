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
