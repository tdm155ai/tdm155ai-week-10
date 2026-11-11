// Air piano: one note per finger. Middle fingers are C; press a finger down (bend it) to play.
import { NAMES, noteName, nearest, drawHand, label, GOLD } from "./common.js";

// Offsets from C. On each hand the thumb side is low, the pinky side high.
export const FINGERS = {
  left:  { 4: -3, 8: -1, 12: 0, 16: 2, 20: 4 },  // thumb A · index B · middle C · ring D · pinky E
  right: { 20: -3, 16: -1, 12: 0, 8: 2, 4: 4 },  // pinky A · ring B · middle C · index D · thumb E
};
export const FINGER_NAMES = { 4: "thumb", 8: "index", 12: "middle", 16: "ring", 20: "pinky" };
export const TIPS = [4, 8, 12, 16, 20];
/** `low` is the right hand's middle-finger C; the left hand plays an octave lower. */
export const fingerNote = (low, side, tip) => low + (side === "left" ? -12 : 0) + FINGERS[side][tip];

const IS_BLACK = [0,1,0,1,0,0,1,0,1,0,1,0];
const NEIGHBOURS = { 4: [8], 8: [4, 12], 12: [8, 16], 16: [12, 20], 20: [16] };
const CHAINS = { 4: [0, 1, 2, 3, 4], 8: [0, 5, 6, 7], 12: [0, 9, 10, 11], 16: [0, 13, 14, 15], 20: [0, 17, 18, 19] };

/** Bend of a joint chain in degrees, from 3D world landmarks (works whichever way the hand faces). */
export function bendAngle(w, chain) {
  let total = 0;
  for (let k = 0; k + 2 < chain.length; k++) {
    const a = w[chain[k]], b = w[chain[k + 1]], c = w[chain[k + 2]];
    const u = [b.x - a.x, b.y - a.y, b.z - a.z], v = [c.x - b.x, c.y - b.y, c.z - b.z];
    const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const len = Math.hypot(...u) * Math.hypot(...v) || 1;
    total += Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180 / Math.PI;
  }
  return total;
}
/** Press signal per finger in "degrees". The thumb presses by tucking toward the palm. */
export function fingerSignal(w, t) {
  if (t !== 4) return bendAngle(w, CHAINS[t]);
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const size = d(w[0], w[9]) || 1;
  return bendAngle(w, [1, 2, 3, 4]) * 0.6 - 150 * d(w[4], w[17]) / size;
}

class PianoVoice {
  constructor(engine, settings) {
    this.engine = engine; this.ac = engine.ac; this.s = settings;
    this.out = engine.bus(1.2, 0.6);
    this.voices = new Map();
  }
  noteOn(midi, vel = 0.8) {
    const bank = this.engine.banks.piano;
    if (!bank) return;
    this.noteOff(midi, 0.03); // re-strike the same key
    const s = nearest(bank, midi);
    const src = this.ac.createBufferSource();
    src.buffer = s.b; src.playbackRate.value = Math.pow(2, (midi - s.m) / 12);
    const g = this.ac.createGain(); g.gain.value = 0.2 + 0.8 * vel;
    src.connect(g).connect(this.out); src.start();
    this.voices.set(midi, { src, g });
    src.onended = () => { if (this.voices.get(midi)?.src === src) this.voices.delete(midi); g.disconnect(); };
  }
  noteOff(midi, tau) {
    const v = this.voices.get(midi);
    if (!v) return;
    const t = this.ac.currentTime;
    tau = tau ?? (this.s.sustain ? 0.8 : 0.1); // damper
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.setTargetAtTime(0, t, tau);
    v.src.stop(t + tau * 6);
    this.voices.delete(midi);
  }
  allOff() { for (const m of [...this.voices.keys()]) this.noteOff(m, 0.08); }
}

/** One piano player. `settings` is shared by every piano: { low, pressDepth, separation, sustain }. */
export class PianoPlayer {
  constructor(engine, settings) {
    this.s = settings;
    this.voice = new PianoVoice(engine, settings);
    this.held = new Map();        // midi -> how many fingers/keys hold it
    this.fingerState = new Map(); // "left12" -> { bend, base, midi }
    this.calib = new Map();       // "left12" -> { up, down }
    this.calibRun = null;
    this.calibMsg = null;
    this.meter = {};
    this.tips = []; this.handSets = [];
    this.text = ""; this.note = ""; this.active = false;
  }

  press(m, vel = 0.75) {
    const n = this.held.get(m) || 0;
    this.held.set(m, n + 1);
    if (n === 0) this.voice.noteOn(m, vel);
  }
  release(m) {
    const n = this.held.get(m) || 0;
    if (n <= 1) { this.held.delete(m); this.voice.noteOff(m); } else this.held.set(m, n - 1);
  }
  releaseAll() { this.held.clear(); this.fingerState.clear(); this.voice.allOff(); }

  startCalibration() {
    this.releaseAll();
    this.calibRun = { phase: "up", until: performance.now() + 2200, samples: new Map() };
  }
  calibTick(now) {
    const r = this.calibRun;
    if (!r || now < r.until) return;
    if (r.phase === "up") { r.phase = "wait"; r.until = now + 900; }
    else if (r.phase === "wait") { r.phase = "down"; r.until = now + 2000; }
    else {
      const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
      let n = 0;
      for (const side of ["left", "right"]) for (const t of TIPS) {
        const id = side + t, up = r.samples.get("up" + id), down = r.samples.get("down" + id);
        if (up?.length > 5 && down?.length > 5) { this.calib.set(id, { up: median(up), down: median(down) }); n++; }
      }
      this.calibMsg = n ? `Calibrated ${n} fingers.` : "Calibration didn't see the hands — try again.";
      this.calibRun = null; this.fingerState.clear();
    }
  }

  /** hands: [{ lm, world, handed }] for this player's zone only (raw, unmirrored camera coords). */
  update({ hands, W, H, now }) {
    const s = this.s;
    hands = hands.filter(h => h.world).slice(0, 2);
    // which hand is which: by screen position when both are visible
    let sides;
    if (hands.length === 2) sides = (1 - hands[0].lm[0].x) < (1 - hands[1].lm[0].x) ? ["left", "right"] : ["right", "left"];
    else sides = hands.map(h => h.handed === "Left" ? "right" : "left"); // model labels assume a mirrored image
    const seen = new Set();
    this.tips = []; this.meter = {};
    this.handSets = hands.map(h => h.lm.map(l => ({ x: l.x * W, y: l.y * H })));

    hands.forEach((hand, hi) => {
      const side = sides[hi], w = hand.world, h = this.handSets[hi];
      // pass 1: how pressed is each finger? (0 = resting, 1 = trigger point)
      const f = {};
      for (const t of TIPS) {
        const id = side + t;
        seen.add(id);
        const raw = fingerSignal(w, t);
        let st = this.fingerState.get(id);
        if (!st) st = { bend: raw, base: raw, midi: null };
        const prev = st.bend;
        st.bend += (t === 4 ? 0.45 : 0.6) * (raw - st.bend); // smooth jitter (thumb is noisier)
        this.fingerState.set(id, st);
        if (this.calibRun) {
          const r = this.calibRun, key = r.phase + id;
          if (!r.samples.has(key)) r.samples.set(key, []);
          if (r.phase !== "wait") r.samples.get(key).push(st.bend);
          f[t] = { st, amount: 0, speed: 0 };
          continue;
        }
        const c = this.calib.get(id);
        let amount;
        if (c && c.down - c.up > 8) amount = (st.bend - c.up) / ((c.down - c.up) * 0.5);
        else {
          amount = (st.bend - st.base) / s.pressDepth;
          if (st.midi == null) st.base += (st.bend < st.base ? 0.3 : 0.01) * (st.bend - st.base); // track resting pose
        }
        f[t] = { st, amount, speed: st.bend - prev };
      }
      // pass 2: decide, ignoring fingers that are only dragged along by a neighbour
      for (const t of TIPS) {
        const { st, amount, speed } = f[t], note = fingerNote(s.low, side, t);
        if (!this.calibRun) {
          const neighbour = Math.max(...NEIGHBOURS[t].map(n => f[n].amount));
          const independent = amount >= s.separation * neighbour;
          if (st.midi == null && amount > 1 && independent) {
            st.midi = note; this.press(note, Math.min(1, 0.4 + Math.max(0, speed) / 25));
          } else if (st.midi != null && (amount < 0.6 || st.midi !== note || amount < 0.5 * neighbour)) {
            this.release(st.midi); st.midi = null;
          }
          this.meter[side + t] = { amount, on: st.midi != null, blocked: amount > 1 && !independent };
        }
        this.tips.push({ x: h[t].x, y: h[t].y, on: st.midi != null, note });
      }
    });
    for (const [id, st] of this.fingerState) {
      if (!seen.has(id)) { if (st.midi != null) this.release(st.midi); this.fingerState.delete(id); }
    }
    this.calibTick(now ?? performance.now());

    const notes = [...this.held.keys()].sort((a, b) => a - b);
    this.active = notes.length > 0;
    if (this.calibRun) {
      this.text = { up: "✋ Hold all fingers UP…", wait: "👇 Now press ALL fingers DOWN", down: "👇 Keep them pressed DOWN…" }[this.calibRun.phase];
      this.note = "";
    } else {
      this.text = notes.length ? "🎹" : (hands.length ? "🎹 Press a finger down" : "🎹 Show your hands");
      this.note = notes.map(noteName).join(" ");
    }
  }

  draw(ctx, W, H, zone, showSkel) {
    if (showSkel) for (const h of this.handSets) drawHand(ctx, h, "rgba(255,255,255,.55)");
    for (const t of this.tips) { // note bubble on each fingertip
      const r = t.on ? 22 : 16;
      ctx.fillStyle = t.on ? GOLD : "rgba(0,0,0,.6)";
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
      label(ctx, NAMES[t.note % 12], t.x, t.y + 1, t.on ? "#1a1208" : "#fff", `700 ${t.on ? 18 : 14}px system-ui`);
    }
    // reference keyboard strip along the bottom of this player's zone, showing the 10 finger notes
    const lo = this.s.low - 15, hi = this.s.low + 4, whites = [];
    for (let m = lo; m <= hi; m++) if (!IS_BLACK[m % 12]) whites.push(m);
    const zw = (zone[1] - zone[0]) * W;
    const kw = Math.min(56, (zw * 0.9) / whites.length), kh = kw * 1.6;
    const left = zone[0] * W + (zw - kw * whites.length) / 2, y0 = H - kh - 12; // display coords
    whites.forEach((m, i) => {
      const x = W - (left + (i + 1) * kw); // canvas is mirrored, so flip x
      ctx.fillStyle = this.held.has(m) ? GOLD : "rgba(255,255,255,.8)";
      ctx.fillRect(x, y0, kw - 2, kh);
      label(ctx, NAMES[m % 12], x + kw / 2 - 1, y0 + kh - 12, "rgba(0,0,0,.65)", "600 12px system-ui");
    });
  }

  stop() { this.calibRun = null; this.releaseAll(); }
  dispose() { this.stop(); setTimeout(() => this.voice.out.disconnect(), 3000); }
}
