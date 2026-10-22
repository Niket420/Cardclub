import { load, save, SOUND_KEY } from "./storage";

type SoundName = "card" | "deal" | "chip" | "turn" | "win" | "error" | "uno" | "click" | "shuffle";

let ctx: AudioContext | null = null;
let enabled: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

export function soundEnabled(): boolean {
  if (enabled === null) enabled = load(SOUND_KEY, true);
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  save(SOUND_KEY, on);
  listeners.forEach((l) => l(on));
}

export function onSoundChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ac.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(ac: AudioContext, start: number, dur: number, freq: number, gain = 0.25) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(start);
}

export function play(name: SoundName) {
  if (!soundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  switch (name) {
    case "card":
      noise(ac, t, 0.07, 2600, 0.35);
      break;
    case "deal":
      for (let i = 0; i < 4; i++) noise(ac, t + i * 0.06, 0.05, 2400 + i * 200, 0.25);
      break;
    case "shuffle":
      for (let i = 0; i < 10; i++) noise(ac, t + i * 0.025, 0.04, 1800 + Math.random() * 1500, 0.15);
      break;
    case "chip":
      tone(ac, 2200, t, 0.08, "triangle", 0.07);
      tone(ac, 3100, t + 0.045, 0.1, "triangle", 0.05);
      break;
    case "turn":
      tone(ac, 660, t, 0.18, "sine", 0.09);
      tone(ac, 990, t + 0.12, 0.28, "sine", 0.08);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.11, 0.35, "triangle", 0.08));
      break;
    case "uno":
      tone(ac, 880, t, 0.12, "square", 0.05);
      tone(ac, 1320, t + 0.1, 0.2, "square", 0.05);
      break;
    case "error":
      tone(ac, 180, t, 0.18, "sawtooth", 0.05);
      break;
    case "click":
      tone(ac, 1400, t, 0.03, "sine", 0.04);
      break;
  }
}

export function buzz(ms: number | number[] = 12) {
  try {
    if (soundEnabled()) navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
