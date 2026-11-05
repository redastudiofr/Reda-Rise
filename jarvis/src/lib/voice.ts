'use client';

import { sentences } from './intents';

/* ---------------- Synthèse vocale ---------------- */

export const VOICE_KEY = 'jarvis-voice';
export const RATE_KEY = 'jarvis-rate';

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

/** French voices, Edge's "Natural" (neural) ones first. */
export function frenchVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) =>
    (/natural/i.test(v.name) ? 100 : 0) + (/fr-FR/i.test(v.lang) ? 20 : 0) + (/henri|remy|rémy|paul|thomas/i.test(v.name) ? 5 : 0) + (v.localService ? 0 : 1);
  return all.filter((v) => /^fr/i.test(v.lang)).sort((a, b) => score(b) - score(a));
}

export function chooseVoice(all: SpeechSynthesisVoice[], wanted: string): SpeechSynthesisVoice | undefined {
  return all.find((v) => v.name === wanted) ?? frenchVoices(all)[0];
}

export function storedVoice(): { name: string; rate: number } {
  try {
    return { name: localStorage.getItem(VOICE_KEY) ?? '', rate: Number(localStorage.getItem(RATE_KEY)) || 0 };
  } catch {
    return { name: '', rate: 0 };
  }
}

export function storeVoice(name: string, rate: number) {
  try {
    localStorage.setItem(VOICE_KEY, name);
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* private mode: settings on the server still hold it */
  }
}

export class Speaker {
  private token = 0;
  voice?: SpeechSynthesisVoice;
  rate = 1;
  speaking = false;
  onLevel: (level: number) => void = () => undefined;
  onState: (speaking: boolean) => void = () => undefined;
  lastSpoken = '';

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Must run inside a click: browsers only allow audio after a gesture. */
  unlock() {
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  /** Resolves when done, or false when interrupted by `stop()`. */
  async speak(text: string): Promise<boolean> {
    this.stop();
    const my = ++this.token;
    this.lastSpoken = text;
    if (!this.supported || !text.trim()) return true;
    this.setSpeaking(true);
    try {
      for (const chunk of sentences(text)) {
        if (my !== this.token) return false;
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = this.voice?.lang ?? 'fr-FR';
          if (this.voice) u.voice = this.voice;
          u.rate = this.rate;
          u.pitch = 0.95;
          u.onboundary = () => this.onLevel(0.55 + Math.random() * 0.45);
          u.onend = () => resolve();
          u.onerror = () => resolve();
          speechSynthesis.speak(u);
          // Chrome-based browsers can stall silently: never wait forever.
          setTimeout(resolve, 2500 + chunk.length * 110);
        });
      }
      return my === this.token;
    } finally {
      if (my === this.token) this.setSpeaking(false);
    }
  }

  stop() {
    this.token++;
    if (this.supported) speechSynthesis.cancel();
    this.setSpeaking(false);
  }

  private setSpeaking(v: boolean) {
    if (this.speaking === v) return;
    this.speaking = v;
    this.onState(v);
    if (!v) this.onLevel(0);
  }
}

/* ---------------- Reconnaissance vocale ---------------- */

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function recognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
}

/** Continuous fr-FR listening that restarts itself; stops on a hard error. */
export class Listener {
  private rec: Rec | null = null;
  private active = false;
  onInterim: (text: string) => void = () => undefined;
  onFinal: (text: string) => void = () => undefined;
  onError: (message: string) => void = () => undefined;
  onState: (listening: boolean) => void = () => undefined;

  start() {
    if (this.active || !recognitionSupported()) return;
    const w = window as unknown as Record<string, new () => Rec>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      this.onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.active = false;
        this.onError('Le micro est refusé par le navigateur. Le mode texte reste disponible.');
      } else if (e.error === 'audio-capture') {
        this.active = false;
        this.onError('Aucun micro détecté. Le mode texte reste disponible.');
      } else if (e.error === 'network') {
        this.onError('La reconnaissance vocale n’a pas accès au réseau.');
      }
      // "no-speech" and "aborted" are normal: onend restarts.
    };
    rec.onend = () => {
      if (this.active) {
        setTimeout(() => {
          try {
            if (this.active) rec.start();
          } catch {
            /* already started */
          }
        }, 250);
      } else this.onState(false);
    };
    this.rec = rec;
    this.active = true;
    try {
      rec.start();
      this.onState(true);
    } catch {
      this.active = false;
      this.onError('La reconnaissance vocale n’a pas pu démarrer.');
    }
  }

  stop() {
    this.active = false;
    this.rec?.abort();
    this.rec = null;
    this.onState(false);
  }

  get listening() {
    return this.active;
  }
}

/** Microphone level for the reactor animation (optional: works without it). */
export async function micLevel(onLevel: (l: number) => void): Promise<() => void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let raf = 0;
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
  } catch {
    return () => undefined;
  }
}
