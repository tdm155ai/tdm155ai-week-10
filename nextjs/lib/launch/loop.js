// THE FILE TO CHANGE: the EDM loop on /launch/xy, made from nothing. Every sound is built from sine waves, saw waves,
// and noise with a bit of math: no samples, so nothing to license. Change a pattern, save, and the page updates.
//
// Each pattern is one bar of 16 steps (sixteenth notes): x = hit, . = rest. Four steps make one beat.

export const BPM = 124;
export const BARS = 8; // the chords repeat to fill these
export const CHORDS = ["Am", "Am", "F", "G"]; // one per bar: Am, C, Dm, Em, F, G (add more in NOTES below)

export const PATTERN = {
  kick: "x...x...x...x...", // four on the floor
  clap: "....x.......x...", // beats 2 and 4
  hat:  "..x...x...x...x.", // the off-beats
  open: "..............x.", // an open hat at the end of the bar
  bass: "..x...x...x..xx.", // the chord's root, two octaves down
  stab: "...x..x....x..x.", // the chord, short and bright
};

export const VOLUME = { kick: 1, clap: 0.5, hat: 0.18, open: 0.16, bass: 0.55, stab: 0.32 };
export const PUMP = 0.65; // sidechain: how far the bass and chords duck under each kick (0 = none): the EDM "pump"

// ── How it works (change it if you like) ─────────────────────────────────────

export const PARTS = Object.keys(PATTERN);
export const LABELS = { kick: "Kick", clap: "Clap", hat: "Hats", open: "Open hat", bass: "Bass", stab: "Chords" };
const NOTES = { Am: [57, 60, 64], C: [48, 52, 55], Dm: [50, 53, 57], Em: [52, 55, 59], F: [53, 57, 60], G: [55, 59, 62] };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Render the loop: one Float32Array per part (a "stem"), all the same length, so they can play in step and be
// switched on and off. `scale` brings the full mix to just under full volume.
export function renderLoop({ rate = 44100, bpm = BPM, bars = BARS, chords = CHORDS, pattern = PATTERN, volume = VOLUME, pump = PUMP } = {}) {
  const step = 60 / bpm / 4; // seconds per sixteenth
  const length = Math.round(bars * 16 * step * rate);
  const tracks = Object.fromEntries(Object.keys(pattern).map((k) => [k, new Float32Array(length)]));
  const duck = new Float32Array(length).fill(1);
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

  // A resonant filter (the classic "biquad"), run over a buffer in place.
  const biquad = (buf, type, freq, q = 0.7) => {
    const w = (2 * Math.PI * freq) / rate, a = Math.sin(w) / (2 * q), c = Math.cos(w);
    const [b0, b1, b2] = type === "low" ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : type === "high" ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [a, 0, -a];
    const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y;
    }
    return buf;
  };
  // Add a sound at time t, wrapping around the end so the loop is seamless.
  const add = (track, t, sound, gain) => {
    const start = Math.round(t * rate);
    for (let i = 0; i < sound.length; i++) track[(start + i) % length] += sound[i] * gain;
  };

  const kick = (() => { // a sine that drops from 150 Hz to 48 Hz: the thump
    const n = Math.round(0.45 * rate), out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) { const t = i / rate; phase += (2 * Math.PI * (48 + 102 * Math.exp(-t * 28))) / rate; out[i] = Math.sin(phase) * Math.exp(-t * 7) * Math.min(1, i / 40); }
    return out;
  })();
  const clap = (() => { // three quick bursts of noise, then a tail, around 1.5 kHz
    const n = Math.round(0.3 * rate), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / rate, burst = t < 0.03 ? Math.exp(-((t * 1000) % 10) * 0.4) : Math.exp(-(t - 0.03) * 18); out[i] = noise() * burst; }
    return biquad(out, "band", 1500, 1.2);
  })();
  const hat = (decay) => { // bright noise, very short
    const n = Math.round(0.25 * rate), out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = noise() * Math.exp((-i / rate) * decay);
    return biquad(out, "high", 7000);
  };
  const saw = (freqs, seconds, cutoff, detune = 0.006) => { // detuned saw waves through a low-pass: bass and chords
    const n = Math.round(seconds * rate), out = new Float32Array(n);
    const voices = freqs.flatMap((f) => [f * (1 - detune), f * (1 + detune)]);
    const phases = voices.map(() => (noise() + 1) / 2);
    for (let i = 0; i < n; i++) {
      let s = 0;
      voices.forEach((f, v) => { phases[v] = (phases[v] + f / rate) % 1; s += phases[v] * 2 - 1; });
      out[i] = (s / voices.length) * Math.min(1, i / 60) * Math.exp((-i / rate) * (3 / seconds));
    }
    return biquad(out, "low", cutoff, 2);
  };

  const closed = hat(45), open = hat(9);
  for (let bar = 0; bar < bars; bar++) {
    const chord = NOTES[chords[bar % chords.length]] || NOTES.Am;
    const bass = saw([hz(chord[0] - 24)], step * 1.6, 700, 0.003);
    const stab = saw(chord.map(hz), step * 1.8, 2600);
    for (let s = 0; s < 16; s++) {
      const t = (bar * 16 + s) * step;
      const on = (k) => pattern[k]?.[s] === "x";
      if (on("kick")) {
        add(tracks.kick, t, kick, volume.kick);
        const at = Math.round(t * rate); // duck the bass and chords right after the kick, then swell back
        for (let i = 0; i < 0.22 * rate; i++) duck[(at + i) % length] = Math.min(duck[(at + i) % length], 1 - pump * Math.exp(-i / rate / 0.07));
      }
      if (on("clap")) add(tracks.clap, t, clap, volume.clap);
      if (on("hat")) add(tracks.hat, t, closed, volume.hat);
      if (on("open")) add(tracks.open, t, open, volume.open);
      if (on("bass")) add(tracks.bass, t, bass, volume.bass);
      if (on("stab")) add(tracks.stab, t, stab, volume.stab);
    }
  }
  for (const k of ["bass", "stab"]) if (tracks[k]) for (let i = 0; i < length; i++) tracks[k][i] *= duck[i];

  let peak = 1e-9;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const k in tracks) sum += tracks[k][i];
    peak = Math.max(peak, Math.abs(sum));
  }
  return { rate, length, seconds: length / rate, barSeconds: 16 * step, tracks, scale: 0.89 / peak };
}
