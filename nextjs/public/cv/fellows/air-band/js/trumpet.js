// Air trumpet: raise an invisible trumpet to your lips; curl the far hand's fingers for valves.
import { mtof, noteName, nearest, drawHand, GOLD } from "./common.js";

// Open-valve notes per register (concert pitch, like a B♭ trumpet's partials)
export const REGISTERS = [
  { name: "Low",  open: 58 }, // B♭3
  { name: "Mid",  open: 65 }, // F4
  { name: "High", open: 70 }, // B♭4
  { name: "Top",  open: 74 }, // D5
];
// valve bits (v1 v2 v3) -> semitones lowered, as on a real trumpet
const FINGERING = { "000": 0, "010": 1, "100": 2, "110": 3, "001": 3, "011": 4, "101": 5, "111": 6 };
// A short original call: rising arpeggio with a held top note
const FANFARE = [[0, .16], [0, .08], [0, .08], [4, .22], [7, .22], [12, .5], [7, .16], [12, .9]];
const XF = 0.3; // crossfade length when looping a recording's sustain

function softClip(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}

/** One trumpet sound: recorded notes (looped while held) with a synth fallback. */
class TrumpetVoice {
  constructor(engine) {
    this.engine = engine;
    const ac = this.ac = engine.ac;
    const out = this.synthOut = engine.bus(1, 1);
    // synth: 2 detuned saws -> soft clip -> moving lowpass -> formant bump -> amp
    this.o1 = ac.createOscillator(); this.o1.type = "sawtooth";
    this.o2 = ac.createOscillator(); this.o2.type = "sawtooth"; this.o2.detune.value = 6;
    const pre = ac.createGain(); pre.gain.value = 0.45;
    const shaper = ac.createWaveShaper(); shaper.curve = softClip(2.2);
    this.lp = ac.createBiquadFilter(); this.lp.type = "lowpass"; this.lp.Q.value = 2; this.lp.frequency.value = 400;
    const formant = ac.createBiquadFilter(); formant.type = "peaking";
    formant.frequency.value = 1300; formant.Q.value = 1.1; formant.gain.value = 7;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120;
    this.amp = ac.createGain(); this.amp.gain.value = 0;
    this.o1.connect(pre); this.o2.connect(pre);
    pre.connect(shaper).connect(this.lp).connect(formant).connect(hp).connect(this.amp).connect(out);
    this.lfo = ac.createOscillator(); this.lfo.frequency.value = 5.6;
    this.vib = ac.createGain(); this.vib.gain.value = 0;
    this.lfo.connect(this.vib); this.vib.connect(this.o1.frequency); this.vib.connect(this.o2.frequency);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = ac.createBufferSource(); this.noise.buffer = nb; this.noise.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 0.8;
    this.ng = ac.createGain(); this.ng.gain.value = 0;
    this.noise.connect(bp).connect(this.ng).connect(this.amp);
    [this.o1, this.o2, this.lfo, this.noise].forEach(n => n.start());
    this.synthPlaying = false; this.freq = 0;
    // recordings
    this.sampleOut = engine.bus(1.5, 1);
    this.cur = null; this.live = new Set(); this.samplePlaying = false; this.midi = null;
    this.useSamples = true;
  }
  get bank() { return this.engine.banks.trumpet; }

  noteOn(midi) {
    if (this.useSamples && this.bank) { this.synthOff(); this.sampleOn(midi); }
    else { this.sampleOff(); this.synthOn(mtof(midi)); }
  }
  noteOff() { this.synthOff(); this.sampleOff(); }
  dispose() {
    this.noteOff();
    const t = this.ac.currentTime + 0.5;
    [this.o1, this.o2, this.lfo, this.noise].forEach(n => n.stop(t));
    setTimeout(() => { this.synthOut.disconnect(); this.sampleOut.disconnect(); }, 1500);
  }

  // ----- recorded voice -----
  seg(s, midi, offset, when, fadeIn) {
    const src = this.ac.createBufferSource();
    src.buffer = s.b;
    const rate = Math.pow(2, (midi - s.m) / 12);
    src.playbackRate.value = rate;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + fadeIn);
    src.connect(g).connect(this.sampleOut);
    src.start(when, offset);
    // loop inside the steady part of the note, after the attack
    const loopEnd = Math.max(1.4, Math.min(s.b.duration - 1.2, 2.8));
    const seg = { src, g, s, midi, endAt: when + (loopEnd - offset) / rate, looped: false };
    this.live.add(seg);
    src.onended = () => { this.live.delete(seg); g.disconnect(); };
    return seg;
  }
  sampleOn(midi) {
    const t = this.ac.currentTime;
    if (!this.samplePlaying) {
      this.cur = this.seg(nearest(this.bank, midi), midi, 0, t, 0.006); // full natural attack
    } else if (midi !== this.midi) {
      const c = this.cur; // slur: fade the old note, start the new one past its attack
      c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(c.g.gain.value, t);
      c.g.gain.linearRampToValueAtTime(0, t + 0.06); c.src.stop(t + 0.11);
      this.cur = this.seg(nearest(this.bank, midi), midi, 0.07, t, 0.045);
    }
    this.midi = midi; this.samplePlaying = true;
  }
  tick() {
    // keep a held note sustaining by crossfading back into the loop region
    const c = this.cur;
    if (!this.samplePlaying || !c || c.looped) return;
    if (this.ac.currentTime > c.endAt - XF - 0.2) {
      const when = Math.max(this.ac.currentTime + 0.02, c.endAt - XF);
      c.looped = true;
      c.g.gain.setValueAtTime(1, when);
      c.g.gain.linearRampToValueAtTime(0, when + XF);
      c.src.stop(when + XF + 0.05);
      this.cur = this.seg(c.s, c.midi, 0.5, when, XF);
    }
  }
  sampleOff() {
    if (!this.samplePlaying) return;
    const t = this.ac.currentTime;
    for (const seg of this.live) {
      seg.g.gain.cancelScheduledValues(t);
      seg.g.gain.setValueAtTime(seg.g.gain.value, t);
      seg.g.gain.setTargetAtTime(0, t, 0.05);
      seg.src.stop(t + 0.4);
    }
    this.samplePlaying = false; this.cur = null;
  }

  // ----- synth voice -----
  synthOn(freq) {
    const t = this.ac.currentTime, f = [this.o1.frequency, this.o2.frequency];
    if (!this.synthPlaying) {
      f.forEach(p => { p.cancelScheduledValues(t); p.setValueAtTime(freq * 0.96, t); p.exponentialRampToValueAtTime(freq, t + 0.06); });
      this.amp.gain.cancelScheduledValues(t);
      this.amp.gain.setValueAtTime(this.amp.gain.value, t);
      this.amp.gain.linearRampToValueAtTime(0.6, t + 0.035);
      this.amp.gain.setTargetAtTime(0.48, t + 0.05, 0.15);
      this.lp.frequency.cancelScheduledValues(t);
      this.lp.frequency.setValueAtTime(freq * 1.2, t);
      this.lp.frequency.exponentialRampToValueAtTime(Math.min(freq * 9, 10000), t + 0.05);
      this.lp.frequency.setTargetAtTime(Math.min(freq * 6, 8000), t + 0.06, 0.2);
      this.ng.gain.cancelScheduledValues(t);
      this.ng.gain.setValueAtTime(0.35, t);
      this.ng.gain.setTargetAtTime(0.03, t + 0.03, 0.06);
      this.vib.gain.cancelScheduledValues(t);
      this.vib.gain.setValueAtTime(0, t);
      this.vib.gain.setTargetAtTime(freq * 0.006, t + 0.35, 0.25);
    } else if (Math.abs(freq - this.freq) > 0.5) {
      f.forEach(p => { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.exponentialRampToValueAtTime(freq, t + 0.035); });
      this.lp.frequency.setTargetAtTime(Math.min(freq * 6, 8000), t, 0.05);
      this.vib.gain.setTargetAtTime(freq * 0.006, t, 0.2);
      this.ng.gain.setValueAtTime(0.12, t); this.ng.gain.setTargetAtTime(0.03, t + 0.02, 0.05);
    }
    this.freq = freq; this.synthPlaying = true;
  }
  synthOff() {
    if (!this.synthPlaying) return;
    const t = this.ac.currentTime;
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setValueAtTime(this.amp.gain.value, t);
    this.amp.gain.setTargetAtTime(0, t, 0.045);
    this.lp.frequency.setTargetAtTime(this.freq * 1.2, t, 0.04);
    this.vib.gain.setTargetAtTime(0, t, 0.05);
    this.ng.gain.setTargetAtTime(0, t, 0.03);
    this.synthPlaying = false;
  }
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const avg = pts => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/** One trumpet player. `settings` is shared by every trumpet: { register, mode, useSamples, sens }. */
export class TrumpetPlayer {
  constructor(engine, settings) {
    this.voice = new TrumpetVoice(engine);
    this.s = settings;
    this.poseOn = false; this.onFrames = 0; this.offFrames = 0;
    this.fanfare = null; this.view = null;
    this.valves = [false, false, false];
    this.text = ""; this.note = ""; this.active = false;
  }

  /** poses / hands: MediaPipe landmarks (normalized, raw camera) for this player's zone only. */
  update({ poses, hands, W, H, keys }) {
    const s = this.s;
    this.voice.useSamples = s.useSamples;
    keys = keys || { valves: [false, false, false], blow: false };
    const P = l => ({ x: l.x * W, y: l.y * H, z: (l.z || 0) * W, v: l.visibility ?? 1 });
    const pl = poses[0]?.map(P);
    const handSets = hands.map(h => h.lm.map(P));

    let mouth = null, sw = W * 0.2, handPts = [], dNear = Infinity, dFar = Infinity, valveHand = null;
    if (pl) {
      mouth = avg([pl[9], pl[10]]);
      sw = dist(pl[11], pl[12]) || sw;
      // hand positions: prefer the hand tracker (palm centers), else pose wrists/knuckles
      if (handSets.length >= 2) handPts = handSets.map(h => avg([h[0], h[5], h[9], h[13], h[17]]));
      else for (const [w, i, p] of [[15, 19, 17], [16, 20, 18]]) if (pl[w].v > 0.35) handPts.push(avg([pl[w], pl[i], pl[p]]));
      if (handPts.length >= 2) [dNear, dFar] = handPts.map(h => dist(h, mouth)).sort((a, b) => a - b);
      // valve hand = tracked hand farthest from the mouth
      if (handSets.length) valveHand = handSets.map(h => ({ h, d: dist(avg([h[0], h[9]]), mouth) })).sort((a, b) => b.d - a.d)[0].h;
    }

    // gesture with hysteresis + debounce so it doesn't flicker
    const k = this.poseOn ? 1.2 : 1;
    const raised = !!mouth && dNear < 0.7 * sw * s.sens * k && dFar < 1.6 * sw * s.sens * k;
    if (raised) { this.onFrames++; this.offFrames = 0; } else { this.offFrames++; this.onFrames = 0; }
    const wasOn = this.poseOn;
    if (!this.poseOn && this.onFrames >= 3) this.poseOn = true;
    if (this.poseOn && this.offFrames >= 5) this.poseOn = false;

    // valves from finger curl (tip close to wrist relative to knuckle)
    const fingerValves = [false, false, false];
    if (valveHand) {
      const h = valveHand, d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      [[8, 5], [12, 9], [16, 13]].forEach(([tip, mcp], i) => { fingerValves[i] = d3(h[tip], h[0]) / d3(h[mcp], h[0]) < 1.45; });
    }
    this.valves = fingerValves.map((v, i) => v || keys.valves[i]);
    const midi = REGISTERS[s.register].open - FINGERING[this.valves.map(v => (v ? 1 : 0)).join("")];

    const blowing = this.poseOn || keys.blow;
    if (s.mode === "hold") {
      if (blowing) this.voice.noteOn(midi); else this.voice.noteOff();
      this.voice.tick();
      this.text = blowing ? "🎺 Playing" : (pl ? "🎺 Raise your trumpet" : "🎺 Step into frame");
      this.note = blowing ? noteName(midi) : "";
    } else {
      if (this.poseOn && !wasOn && !this.fanfare) this.playFanfare();
      if (!this.fanfare) {
        this.voice.noteOff();
        this.text = pl ? "🎺 Raise your trumpet for a fanfare" : "🎺 Step into frame";
        this.note = "";
      }
    }
    this.active = (s.mode === "hold" && blowing) || !!this.fanfare;
    this.view = { mouth, sw, handPts, handSets, valveHand, fingerValves, raised };
  }

  playFanfare() {
    const base = REGISTERS[Math.min(this.s.register, 2)].open;
    let i = 0;
    const step = () => {
      if (i >= FANFARE.length || this.s.mode !== "fanfare") { this.voice.noteOff(); this.fanfare = null; return; }
      const [semi, dur] = FANFARE[i++];
      this.voice.noteOff();
      setTimeout(() => { if (!this.fanfare) return; this.voice.noteOn(base + semi); this.text = "🎺 Fanfare!"; this.note = noteName(base + semi); }, 25);
      this.fanfare = setTimeout(step, dur * 1000 + 25);
    };
    step();
  }

  draw(ctx, W, H, zone, showSkel) {
    const v = this.view;
    if (!v || !showSkel) return;
    const dim = "rgba(255,255,255,.45)";
    if (v.mouth) {
      ctx.lineWidth = 3; ctx.strokeStyle = v.raised ? GOLD : dim; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(v.mouth.x, v.mouth.y, 0.7 * v.sw * this.s.sens, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(v.mouth.x, v.mouth.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    for (const h of v.handSets) {
      drawHand(ctx, h, h === v.valveHand ? "rgba(255,215,122,.9)" : "rgba(255,255,255,.7)");
      if (h === v.valveHand) [8, 12, 16].forEach((tip, i) => {
        ctx.fillStyle = v.fingerValves[i] ? GOLD : "#fff";
        ctx.beginPath(); ctx.arc(h[tip].x, h[tip].y, v.fingerValves[i] ? 10 : 5, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (v.handSets.length < 2) {
      ctx.fillStyle = dim;
      for (const p of v.handPts) { ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  stop() { clearTimeout(this.fanfare); this.fanfare = null; this.voice.noteOff(); }
  dispose() { this.stop(); this.voice.dispose(); }
}
