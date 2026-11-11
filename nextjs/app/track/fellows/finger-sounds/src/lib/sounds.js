// sounds.js: the built-in sounds, made in the browser with the Web Audio API.
//
// Nothing here is a recording, so nothing needs licensing or downloading. Each
// sound is a small recipe: build(ctx, out) wires oscillators, noise and filters
// together inside an OfflineAudioContext, which renders it once into an
// AudioBuffer when the page loads. Pinches then play those buffers instantly.
//
// TO ADD A SOUND: add an entry to SOUNDS with a label, a length in seconds and a
// build function that connects to `out`. It appears in every pad's menu.

const SAMPLE_RATE = 48000;

// ---------- building blocks ----------

function noise(ctx, seconds, when = 0) {
  const length = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.start(when);
  return source;
}

function osc(ctx, type, frequency, start = 0, stop = 2) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = frequency;
  o.start(start);
  o.stop(stop);
  return o;
}

function filter(ctx, type, frequency, Q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  return f;
}

function silentGain(ctx) {
  const g = ctx.createGain();
  g.gain.value = 0;
  return g;
}

// A percussive envelope: up to `peak` in `attack` seconds, then dying away
// over `decay` seconds.
function hit(param, t, peak, attack, decay) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// A sine or other tone with its own envelope, straight to `out`.
function tone(ctx, out, type, frequency, peak, decay, t = 0) {
  const g = silentGain(ctx);
  hit(g.gain, t, peak, 0.001, decay);
  osc(ctx, type, frequency, t, t + decay + 0.05).connect(g).connect(out);
}

// A burst of filtered noise, straight to `out`.
function noiseHit(ctx, out, type, frequency, Q, peak, decay, t = 0) {
  const g = silentGain(ctx);
  hit(g.gain, t, peak, 0.001, decay);
  noise(ctx, decay + 0.05, t).connect(filter(ctx, type, frequency, Q)).connect(g).connect(out);
}

// A timbale: a bright drum head, a ringing metal shell, and the stick's click.
function timbale(ctx, out, f) {
  const head = osc(ctx, "triangle", f, 0, 0.8);
  head.frequency.setValueAtTime(f * 1.07, 0);
  head.frequency.exponentialRampToValueAtTime(f, 0.03);
  const headGain = silentGain(ctx);
  hit(headGain.gain, 0, 0.7, 0.001, 0.38);
  head.connect(headGain).connect(out);
  // The shell rings at frequencies that aren't simple multiples of the head.
  for (const [ratio, level, decay] of [[1.58, 0.22, 0.5], [2.29, 0.16, 0.55], [3.17, 0.09, 0.4], [4.1, 0.05, 0.3]]) {
    tone(ctx, out, "sine", f * ratio, level, decay);
  }
  noiseHit(ctx, out, "bandpass", 3600, 1.4, 0.55, 0.025);
}

// ---------- the sounds ----------

export const SOUNDS = {
  clap: {
    label: "Clap",
    seconds: 0.5,
    build(ctx, out) {
      // A clap is several hands-worth of slaps a few milliseconds apart,
      // then the room answering.
      const g = silentGain(ctx);
      for (const t of [0, 0.011, 0.022]) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.001);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      }
      g.gain.setValueAtTime(0.0001, 0.033);
      g.gain.exponentialRampToValueAtTime(0.85, 0.034);
      g.gain.exponentialRampToValueAtTime(0.0001, 0.034 + 0.22);
      noise(ctx, 0.5).connect(filter(ctx, "highpass", 650)).connect(filter(ctx, "bandpass", 1150, 1.1)).connect(g).connect(out);
    },
  },
  "timbale-high": { label: "Timbale high", seconds: 0.8, build: (ctx, out) => timbale(ctx, out, 520) },
  "timbale-low": { label: "Timbale low", seconds: 0.8, build: (ctx, out) => timbale(ctx, out, 345) },
  tambourine: {
    label: "Tambourine",
    seconds: 0.5,
    build(ctx, out) {
      // The jingles shake a few times quickly after the hit.
      const g = silentGain(ctx);
      [0, 0.018, 0.035, 0.056, 0.082].forEach((t, i) => {
        const peak = 0.75 * Math.pow(0.72, i);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
        g.gain.exponentialRampToValueAtTime(peak * 0.2, t + 0.016);
      });
      g.gain.exponentialRampToValueAtTime(0.0001, 0.45);
      noise(ctx, 0.5).connect(filter(ctx, "highpass", 5200)).connect(filter(ctx, "bandpass", 9000, 0.8)).connect(g).connect(out);
      for (const [f, level] of [[5300, 0.05], [6950, 0.04], [8800, 0.03]]) tone(ctx, out, "square", f, level, 0.28);
      tone(ctx, out, "sine", 230, 0.25, 0.06);
    },
  },
  cowbell: {
    label: "Cowbell",
    seconds: 0.5,
    build(ctx, out) {
      const mix = ctx.createGain();
      mix.gain.value = 0.5;
      osc(ctx, "square", 540, 0, 0.5).connect(mix);
      osc(ctx, "square", 800, 0, 0.5).connect(mix);
      const g = silentGain(ctx);
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(0.6, 0.002);
      g.gain.exponentialRampToValueAtTime(0.18, 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, 0.45);
      mix.connect(filter(ctx, "bandpass", 1000, 0.9)).connect(g).connect(out);
    },
  },
  kick: {
    label: "Kick drum",
    seconds: 0.6,
    build(ctx, out) {
      const body = osc(ctx, "sine", 160, 0, 0.6);
      body.frequency.setValueAtTime(160, 0);
      body.frequency.exponentialRampToValueAtTime(48, 0.12);
      const g = silentGain(ctx);
      hit(g.gain, 0, 1, 0.002, 0.48);
      body.connect(g).connect(out);
      noiseHit(ctx, out, "highpass", 2000, 0.7, 0.3, 0.012);
    },
  },
  snare: {
    label: "Snare",
    seconds: 0.35,
    build(ctx, out) {
      noiseHit(ctx, out, "highpass", 1200, 0.7, 0.8, 0.2);
      tone(ctx, out, "triangle", 185, 0.6, 0.09);
      tone(ctx, out, "triangle", 330, 0.3, 0.06);
    },
  },
  hat: {
    label: "Hi-hat",
    seconds: 0.15,
    build(ctx, out) {
      // Six square waves at odd ratios make a metallic clang; keep only the top.
      const mix = ctx.createGain();
      mix.gain.value = 1 / 6;
      for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) osc(ctx, "square", f, 0, 0.15).connect(mix);
      const g = silentGain(ctx);
      hit(g.gain, 0, 0.6, 0.001, 0.06);
      mix.connect(filter(ctx, "highpass", 7000)).connect(filter(ctx, "bandpass", 10000, 0.8)).connect(g).connect(out);
    },
  },
  snap: {
    label: "Finger snap",
    seconds: 0.15,
    build(ctx, out) {
      noiseHit(ctx, out, "bandpass", 2800, 2, 0.9, 0.03);
      tone(ctx, out, "sine", 1800, 0.15, 0.02);
    },
  },
  rim: {
    label: "Rimshot",
    seconds: 0.25,
    build(ctx, out) {
      tone(ctx, out, "triangle", 1700, 0.4, 0.03);
      tone(ctx, out, "sine", 480, 0.3, 0.05);
      noiseHit(ctx, out, "bandpass", 4000, 1.5, 0.5, 0.015);
    },
  },
  woodblock: {
    label: "Wood block",
    seconds: 0.3,
    build(ctx, out) {
      const knock = osc(ctx, "sine", 920, 0, 0.3);
      knock.frequency.setValueAtTime(960, 0);
      knock.frequency.exponentialRampToValueAtTime(880, 0.04);
      const g = silentGain(ctx);
      hit(g.gain, 0, 0.8, 0.001, 0.12);
      knock.connect(g).connect(out);
      tone(ctx, out, "sine", 880 * 2.7, 0.2, 0.05);
      noiseHit(ctx, out, "bandpass", 2000, 1.2, 0.3, 0.01);
    },
  },
  bell: {
    label: "Bell",
    seconds: 1.8,
    build(ctx, out) {
      for (const [ratio, level, decay] of [[1, 0.5, 1.6], [2.76, 0.25, 0.9], [5.4, 0.12, 0.45], [8.93, 0.06, 0.25]]) {
        tone(ctx, out, "sine", 880 * ratio, level, decay);
      }
    },
  },
};

export const SOUND_IDS = Object.keys(SOUNDS);

// Renders one sound into an AudioBuffer, scaled so every sound peaks at the
// same level.
export async function renderSound(id) {
  const sound = SOUNDS[id];
  const ctx = new OfflineAudioContext(1, Math.ceil(sound.seconds * SAMPLE_RATE), SAMPLE_RATE);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  sound.build(ctx, out);
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0) {
    const scale = 0.85 / peak;
    for (let i = 0; i < data.length; i++) data[i] *= scale;
  }
  return buffer;
}
