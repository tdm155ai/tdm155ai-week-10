// Synthesized drums (Web Audio, no samples). Everything is generated in the browser.
let ctx = null;
let master = null;
let noiseBuf = null;

export function audioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Air Band: play through the band's shared AudioContext and master volume instead of a private one.
export function useAudio(context, destination) {
  ctx = context;
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(t, v, { f0, f1 = f0, dur = 0.3, type = 'sine', gain = 0.8 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  env(g, t, gain * v, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(t, v, { dur = 0.15, filter = 'highpass', freq = 6000, q = 0.7, gain = 0.6, offset = 0 }) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, gain * v, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, offset);
  s.stop(t + dur + 0.05);
}

const metal = (t, v, freqs, dur, gain) => {
  for (const fr of freqs) {
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = fr;
    f.type = 'highpass';
    f.frequency.value = 7000;
    env(g, t, gain * v, dur);
    o.connect(f).connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
};

export const VOICES = {
  // acoustic kit
  kick: (t, v) => { tone(t, v, { f0: 160, f1: 45, dur: 0.45, gain: 1.0 }); noise(t, v, { dur: 0.02, filter: 'lowpass', freq: 800, gain: 0.3 }); },
  snare: (t, v) => { noise(t, v, { dur: 0.18, filter: 'highpass', freq: 1800, gain: 0.7 }); tone(t, v, { f0: 230, f1: 170, dur: 0.12, type: 'triangle', gain: 0.5 }); },
  hatC: (t, v) => noise(t, v, { dur: 0.05, freq: 8000, gain: 0.45 }),
  hatO: (t, v) => noise(t, v, { dur: 0.35, freq: 7000, gain: 0.4 }),
  tomHi: (t, v) => tone(t, v, { f0: 260, f1: 150, dur: 0.3, gain: 0.9 }),
  tomLo: (t, v) => tone(t, v, { f0: 160, f1: 80, dur: 0.45, gain: 1.0 }),
  crash: (t, v) => { noise(t, v, { dur: 1.4, freq: 5000, gain: 0.5 }); metal(t, v, [3100, 4400, 5900], 0.9, 0.04); },
  rim: (t, v) => { tone(t, v, { f0: 1700, f1: 1500, dur: 0.03, type: 'square', gain: 0.3 }); noise(t, v, { dur: 0.04, filter: 'bandpass', freq: 3000, gain: 0.4 }); },
  // bongos
  bongoHi: (t, v) => { tone(t, v, { f0: 470, f1: 410, dur: 0.22, type: 'triangle', gain: 0.9 }); noise(t, v, { dur: 0.02, filter: 'bandpass', freq: 1500, gain: 0.3 }); },
  bongoLo: (t, v) => { tone(t, v, { f0: 330, f1: 285, dur: 0.28, type: 'triangle', gain: 0.9 }); noise(t, v, { dur: 0.02, filter: 'bandpass', freq: 1200, gain: 0.3 }); },
  bongoHiSlap: (t, v) => { tone(t, v, { f0: 520, f1: 440, dur: 0.1, type: 'triangle', gain: 0.6 }); noise(t, v, { dur: 0.07, filter: 'bandpass', freq: 2600, q: 1.5, gain: 0.7 }); },
  bongoLoSlap: (t, v) => { tone(t, v, { f0: 370, f1: 300, dur: 0.12, type: 'triangle', gain: 0.6 }); noise(t, v, { dur: 0.07, filter: 'bandpass', freq: 2000, q: 1.5, gain: 0.7 }); },
  block: (t, v) => tone(t, v, { f0: 1100, f1: 1000, dur: 0.07, type: 'square', gain: 0.35 }),
  cowbell: (t, v) => metal(t, v, [540, 800], 0.35, 0.12),
  shaker: (t, v) => noise(t, v, { dur: 0.09, filter: 'bandpass', freq: 6500, q: 1, gain: 0.5 }),
  // congas
  congaHi: (t, v) => { tone(t, v, { f0: 380, f1: 330, dur: 0.35, type: 'triangle', gain: 0.9 }); noise(t, v, { dur: 0.02, filter: 'bandpass', freq: 1000, gain: 0.3 }); },
  congaLo: (t, v) => { tone(t, v, { f0: 250, f1: 215, dur: 0.45, type: 'triangle', gain: 1.0 }); noise(t, v, { dur: 0.02, filter: 'bandpass', freq: 800, gain: 0.3 }); },
  congaSlap: (t, v) => { noise(t, v, { dur: 0.09, filter: 'bandpass', freq: 1800, q: 1.2, gain: 0.8 }); tone(t, v, { f0: 420, f1: 300, dur: 0.08, type: 'triangle', gain: 0.5 }); },
  congaMute: (t, v) => tone(t, v, { f0: 300, f1: 260, dur: 0.09, type: 'triangle', gain: 0.8 }),
  // electro
  e_kick: (t, v) => tone(t, v, { f0: 120, f1: 38, dur: 0.9, gain: 1.1 }),
  e_snare: (t, v) => { noise(t, v, { dur: 0.22, freq: 1500, gain: 0.6 }); tone(t, v, { f0: 190, f1: 150, dur: 0.15, type: 'triangle', gain: 0.5 }); },
  e_clap: (t, v) => { for (let i = 0; i < 3; i++) noise(t + i * 0.012, v, { dur: 0.05, filter: 'bandpass', freq: 1500, q: 1.2, gain: 0.55 }); noise(t + 0.036, v, { dur: 0.2, filter: 'bandpass', freq: 1500, q: 1.2, gain: 0.4 }); },
  e_hat: (t, v) => metal(t, v, [263, 400, 421, 474, 587, 845], 0.06, 0.05),
  e_hatO: (t, v) => metal(t, v, [263, 400, 421, 474, 587, 845], 0.3, 0.05),
  e_cow: (t, v) => metal(t, v, [587, 845], 0.3, 0.12),
  e_tom: (t, v) => tone(t, v, { f0: 200, f1: 90, dur: 0.4, type: 'sawtooth', gain: 0.35 }),
  e_zap: (t, v) => tone(t, v, { f0: 1800, f1: 120, dur: 0.18, type: 'square', gain: 0.25 }),
};

// Each kit has four zones across the screen. "stick" = pointed finger, "palm" = open palm.
export const KITS = [
  { name: 'Drum kit', color: '#ff7a59', zones: [
    { label: 'Hi-hat', stick: 'hatC', palm: 'hatO' },
    { label: 'Snare', stick: 'snare', palm: 'kick' },
    { label: 'Tom', stick: 'tomHi', palm: 'tomLo' },
    { label: 'Crash', stick: 'crash', palm: 'kick' },
  ] },
  { name: 'Bongos', color: '#f6c344', zones: [
    { label: 'Hi', stick: 'bongoHiSlap', palm: 'bongoHi' },
    { label: 'Lo', stick: 'bongoLoSlap', palm: 'bongoLo' },
    { label: 'Block', stick: 'block', palm: 'bongoHi' },
    { label: 'Cowbell', stick: 'cowbell', palm: 'bongoLo' },
  ] },
  { name: 'Congas', color: '#7bd88f', zones: [
    { label: 'Mute', stick: 'congaMute', palm: 'congaHi' },
    { label: 'Slap', stick: 'congaSlap', palm: 'congaHi' },
    { label: 'Hi', stick: 'rim', palm: 'congaHi' },
    { label: 'Low', stick: 'congaSlap', palm: 'congaLo' },
  ] },
  { name: 'Electro', color: '#6cc5ff', zones: [
    { label: 'Kick', stick: 'e_hat', palm: 'e_kick' },
    { label: 'Snare', stick: 'e_snare', palm: 'e_clap' },
    { label: 'Hat', stick: 'e_hat', palm: 'e_hatO' },
    { label: 'Zap', stick: 'e_zap', palm: 'e_tom' },
  ] },
];

export function play(voice, when = 0, velocity = 0.8) {
  const c = audioContext();
  const fn = VOICES[voice];
  if (!fn) return;
  fn(Math.max(when, c.currentTime), Math.min(1, Math.max(0.15, velocity)));
}
