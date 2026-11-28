/**
 * Festive sound effects engine.
 * Plays the custom "FAAAAH!" audio clip on reveal (with synthesized fallback)
 * plus Web Audio API pops, boings, chimes, oven bell, wheel tick, and whoosh effects
 * with full global mute support.
 */

import type { ThemeId } from '../types/secretSanta';

const FAAAAH_AUDIO_URL = '/assets/aistudio/Fahhh_-_QuickSounds.com_21994c56.mp3';
const CHRISTMAS_REVEAL_AUDIO_URL =
  '/assets/aistudio/dragon-studio-jingle-bells-christmas-439615_65f07480.mp3';
const CHOCOLATE_REVEAL_AUDIO_URL =
  '/assets/aistudio/chocolate_truffle_pop_510a5a2a.mp3';
const SNOW_GLOBE_MUSIC_URL =
  '/assets/aistudio/freesound_community-music-box-we-wish-you-a-merry-christmas-79501_dcc07483.mp3';

let audioCtx: AudioContext | null = null;
let faaaahAudio: HTMLAudioElement | null = null;
let christmasRevealAudio: HTMLAudioElement | null = null;
let chocolateRevealAudio: HTMLAudioElement | null = null;
let snowGlobeAudio: HTMLAudioElement | null = null;
let snowGlobeDesiredActive = false;
let isMutedGlobal = false;
const muteListeners = new Set<(muted: boolean) => void>();

function getFaaaahAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!faaaahAudio) {
    faaaahAudio = new Audio(FAAAAH_AUDIO_URL);
    faaaahAudio.preload = 'auto';
    faaaahAudio.volume = 0.95;
  }
  return faaaahAudio;
}

function getChristmasRevealAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!christmasRevealAudio) {
    christmasRevealAudio = new Audio(CHRISTMAS_REVEAL_AUDIO_URL);
    christmasRevealAudio.preload = 'auto';
    christmasRevealAudio.volume = 0.95;
  }
  return christmasRevealAudio;
}

function getChocolateRevealAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!chocolateRevealAudio) {
    chocolateRevealAudio = new Audio(CHOCOLATE_REVEAL_AUDIO_URL);
    chocolateRevealAudio.preload = 'auto';
    chocolateRevealAudio.volume = 0.95;
  }
  return chocolateRevealAudio;
}

function getSnowGlobeAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!snowGlobeAudio) {
    snowGlobeAudio = new Audio(SNOW_GLOBE_MUSIC_URL);
    snowGlobeAudio.preload = 'auto';
    snowGlobeAudio.loop = true;
    snowGlobeAudio.volume = 0.45;
  }
  return snowGlobeAudio;
}

export function subscribeSoundMuted(listener: (muted: boolean) => void): () => void {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

export function setSoundMuted(muted: boolean) {
  isMutedGlobal = muted;
  if (muted) {
    if (faaaahAudio) {
      faaaahAudio.pause();
      faaaahAudio.currentTime = 0;
    }
    if (christmasRevealAudio) {
      christmasRevealAudio.pause();
      christmasRevealAudio.currentTime = 0;
    }
    if (chocolateRevealAudio) {
      chocolateRevealAudio.pause();
      chocolateRevealAudio.currentTime = 0;
    }
    if (snowGlobeAudio) {
      snowGlobeAudio.pause();
    }
  } else if (snowGlobeDesiredActive) {
    const bg = getSnowGlobeAudio();
    if (bg) {
      void bg.play().catch(() => {
        // Autoplay may wait for next gesture
      });
    }
  }
  muteListeners.forEach((cb) => cb(muted));
}

export function getSoundMuted(): boolean {
  return isMutedGlobal;
}

export async function startSnowGlobeMusic(): Promise<boolean> {
  snowGlobeDesiredActive = true;
  if (isMutedGlobal) return false;
  const audio = getSnowGlobeAudio();
  if (!audio) return false;
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export function pauseSnowGlobeMusic(): void {
  snowGlobeDesiredActive = false;
  if (snowGlobeAudio) {
    snowGlobeAudio.pause();
  }
}

export function stopSnowGlobeMusic(): void {
  snowGlobeDesiredActive = false;
  if (snowGlobeAudio) {
    snowGlobeAudio.pause();
    snowGlobeAudio.currentTime = 0;
  }
}

function getAudioContext(): AudioContext | null {
  if (isMutedGlobal) return null;
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function playPopSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(340, now);
  osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

export function playBoingSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
  osc.frequency.exponentialRampToValueAtTime(290, now + 0.22);
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

export function playChimeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.075);
    gain.gain.setValueAtTime(0.001, now + idx * 0.075);
    gain.gain.linearRampToValueAtTime(0.16, now + idx * 0.075 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.075);
    osc.stop(now + idx * 0.075 + 0.38);
  });
}

export function playOvenBellSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [1318.5, 2637.0].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(idx === 0 ? 0.22 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.85);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.9);
  });
}

export function playWheelTickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(920, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);
  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
}

export function playMailboxWhooshSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(280, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.14, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.28);
}

export function playMagicSparkleSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [783.99, 987.77, 1174.66, 1567.98, 2093.0];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const t = now + i * 0.06;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}

/**
 * Plays the Jingle Bells audio clip on Secret Santa reveal (Christmas theme only),
 * respecting the global mute toggle, with a Web Audio chime fallback.
 */
export function playChristmasRevealSound() {
  if (isMutedGlobal) return;
  const audio = getChristmasRevealAudio();
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          playChimeSound();
        });
      }
      return;
    } catch {
      // Fall through to chime fallback
    }
  }
  playChimeSound();
}

/**
 * Plays the Chocolate Truffle Pop audio clip on Secret Santa reveal (Chocolate theme only),
 * respecting the global mute toggle, with a Web Audio chime fallback.
 */
export function playChocolateRevealSound() {
  if (isMutedGlobal) return;
  const audio = getChocolateRevealAudio();
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          playChimeSound();
        });
      }
      return;
    } catch {
      // Fall through to chime fallback
    }
  }
  playChimeSound();
}

/**
 * Plays the appropriate Secret Santa reveal sound for the active theme:
 * - Christmas ('santa') theme: Jingle Bells chime clip
 * - Chocolate ('chocolate') theme: Chocolate Truffle Pop clip
 * - Funny ('funny') theme: FAAAAH clip
 */
export function playRevealSound(theme: ThemeId) {
  if (theme === 'santa') {
    playChristmasRevealSound();
  } else if (theme === 'chocolate') {
    playChocolateRevealSound();
  } else {
    playFaaaahSound();
  }
}

/**
 * Plays the custom "FAAAAH!" audio clip on reveal, respecting the global mute toggle,
 * with a synthesized Web Audio fallback if playback fails.
 */
export function playFaaaahSound() {
  if (isMutedGlobal) return;
  const audio = getFaaaahAudio();
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          playSynthesizedFaaaahFallback();
        });
      }
      return;
    } catch {
      // Fall through to synthesized fallback
    }
  }
  playSynthesizedFaaaahFallback();
}

function playSynthesizedFaaaahFallback() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const bufferSize = Math.floor(ctx.sampleRate * 0.14);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(2400, now);
  noiseFilter.Q.setValueAtTime(1.4, now);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, now);
  noiseGain.gain.linearRampToValueAtTime(0.24, now + 0.04);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  const chordFreqs = [220, 277.18, 329.63, 440];
  const formant1 = ctx.createBiquadFilter();
  formant1.type = 'bandpass';
  formant1.frequency.setValueAtTime(750, now + 0.08);
  formant1.Q.setValueAtTime(3.2, now + 0.08);

  const formant2 = ctx.createBiquadFilter();
  formant2.type = 'bandpass';
  formant2.frequency.setValueAtTime(1250, now + 0.08);
  formant2.Q.setValueAtTime(3.5, now + 0.08);

  const masterVoiceGain = ctx.createGain();
  masterVoiceGain.gain.setValueAtTime(0.001, now + 0.07);
  masterVoiceGain.gain.linearRampToValueAtTime(0.32, now + 0.22);
  masterVoiceGain.gain.setValueAtTime(0.28, now + 0.85);
  masterVoiceGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

  formant1.connect(masterVoiceGain);
  formant2.connect(masterVoiceGain);
  masterVoiceGain.connect(ctx.destination);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(5.5, now + 0.2);
  lfoGain.gain.setValueAtTime(6, now + 0.2);
  lfo.connect(lfoGain);
  lfo.start(now + 0.08);
  lfo.stop(now + 1.48);

  chordFreqs.forEach((baseFreq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq * 0.92, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.24);
    lfoGain.connect(osc.frequency);
    osc.connect(formant1);
    osc.connect(formant2);
    osc.start(now + 0.08);
    osc.stop(now + 1.48);
  });

  const sparkles = [880, 1108.73, 1318.51, 1760];
  sparkles.forEach((freq, i) => {
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    const start = now + 0.16 + i * 0.08;
    bell.frequency.setValueAtTime(freq, start);
    bellGain.gain.setValueAtTime(0.001, start);
    bellGain.gain.linearRampToValueAtTime(0.11, start + 0.02);
    bellGain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(start);
    bell.stop(start + 0.6);
  });
}
