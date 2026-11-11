// looper.js: a loop of beats that you play into and keep adding to.
//
// The loop is a few beats long (4 to start). Press Record and you hear a count
// of four; from the next beat 1, every pad you play is added to the loop at the
// moment you played it, rounded to the nearest 16th note ("Snap"). The loop
// keeps going round, so you can add a kick on one pass, claps on the next, a
// tambourine after that. Undo takes away the last thing you added.
//
// Timing: the browser's timers aren't steady enough for music, so a timer
// wakes every 25 ms and books the next 120 ms of hits on the audio clock,
// which is exact. (This is the usual Web Audio "lookahead" pattern.)

import { SOUNDS } from "./sounds.js";

export const SNAPS = { off: 0, "1/8": 0.5, "1/16": 0.25 };
export const STEPS_PER_BEAT = 4; // the grid shows 16th notes
export const COUNT_IN_BEATS = 4;
export const LENGTHS = [4, 8, 16];

const LOOKAHEAD = 0.12; // seconds of sound booked ahead
const TICK_MS = 25;
// About how long the camera and hand tracking take to see a pinch. Hits from
// the camera are moved this much earlier, so they land where you meant them.
const CAMERA_DELAY = 0.05;
const STORAGE_KEY = "finger-sounds:loop";

const mod = (a, n) => ((a % n) + n) % n;

export class Looper {
  constructor(board) {
    this.board = board;
    this.onChange = null; // called with snapshot() whenever something changes
    this.onHit = null; // called with (hit, when) as the loop plays each hit
    this.bpm = 100;
    this.beats = 4;
    this.snap = "1/16";
    this.click = true;
    this.hits = []; // [{ t: position in beats from the loop's start, sound: key }]
    this.history = []; // earlier versions of the loop ({ hits, beats }), for Undo
    this.playing = false;
    this.recording = false;
    this.loopStart = 0; // audio-clock time of the first beat 1
    this.bookedUntil = 0;
    this.pending = []; // sounds booked for later: [{ node, when }]
    this.timer = null;
    this.load();
  }

  get beatSeconds() {
    return 60 / this.bpm;
  }

  get loopSeconds() {
    return this.beats * this.beatSeconds;
  }

  snapshot() {
    return {
      hits: this.hits,
      bpm: this.bpm,
      beats: this.beats,
      snap: this.snap,
      click: this.click,
      playing: this.playing,
      recording: this.recording,
      canUndo: this.history.length > 0,
    };
  }

  changed() {
    this.save();
    this.onChange?.(this.snapshot());
  }

  // Where the loop is now, in beats (0 up to `beats`). Negative during the
  // count-in (-4 to 0). null when stopped.
  position() {
    if (!this.playing || !this.board.ctx) return null;
    const p = (this.board.ctx.currentTime - this.loopStart) / this.beatSeconds;
    return p < 0 ? p : p % this.beats;
  }

  // ---------- transport ----------

  play({ countIn = false } = {}) {
    this.board.unlock();
    const now = this.board.ctx.currentTime;
    this.loopStart = now + 0.08 + (countIn ? COUNT_IN_BEATS * this.beatSeconds : 0);
    this.bookedUntil = now;
    this.playing = true;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.book(), TICK_MS);
    this.book();
    this.changed();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.cancelBooked();
    this.playing = false;
    if (this.recording) this.finishRecording();
    this.changed();
  }

  togglePlay() {
    if (this.playing) this.stop();
    else this.play();
  }

  // Starts adding to the loop (with a count-in if the loop is stopped), or
  // stops adding while the loop keeps playing.
  toggleRecord() {
    if (this.recording) {
      this.finishRecording();
      this.changed();
      return;
    }
    this.remember();
    this.recording = true;
    if (this.playing) this.changed();
    else this.play({ countIn: true });
  }

  finishRecording() {
    this.recording = false;
    // Nothing was added: don't leave an empty step in Undo.
    const last = this.history.at(-1);
    if (last?.hits === this.hits && last.beats === this.beats) this.history.pop();
  }

  // ---------- adding and removing hits ----------

  // A pad was played. While recording, add it to the loop.
  record(sound, { fromCamera = false } = {}) {
    if (!this.recording || !this.playing || !sound) return;
    const ctx = this.board.ctx;
    const heardAt = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - (fromCamera ? CAMERA_DELAY : 0);
    let p = (heardAt - this.loopStart) / this.beatSeconds;
    if (p < -0.25) return; // still counting in
    const step = SNAPS[this.snap];
    if (step) p = Math.round(p / step) * step;
    const t = mod(p, this.beats);

    // Playing the same thing again in the same place doesn't double it.
    const near = step ? 1e-6 : 0.05;
    if (this.hits.some((h) => h.sound === sound && Math.abs(h.t - t) < near)) return;

    const hit = { t, sound };
    // If snapping moved the hit a little later than now, the loop would play
    // it again a moment after you did; skip that one time.
    let when = this.loopStart + Math.floor((heardAt - this.loopStart) / this.loopSeconds) * this.loopSeconds + t * this.beatSeconds;
    if (when - heardAt > this.loopSeconds / 2) when -= this.loopSeconds;
    if (heardAt - when > this.loopSeconds / 2) when += this.loopSeconds;
    if (when >= this.bookedUntil) hit.skipAt = when;
    this.hits = [...this.hits, hit];
    this.changed();
  }

  // Click on the grid: add a hit at this 16th note, or take away what's there.
  // Returns true if a hit was added.
  toggleStep(sound, stepIndex) {
    const from = stepIndex / STEPS_PER_BEAT;
    const to = (stepIndex + 1) / STEPS_PER_BEAT;
    const inStep = (h) => h.sound === sound && h.t >= from - 1e-6 && h.t < to - 1e-6;
    this.remember();
    const added = !this.hits.some(inStep);
    this.hits = added ? [...this.hits, { t: from, sound }] : this.hits.filter((h) => !inStep(h));
    this.changed();
    return added;
  }

  // Takes away the last thing added. During recording, that's everything added
  // since Record was pressed, and recording stops.
  undo() {
    if (this.recording) this.finishRecording();
    const last = this.history.pop();
    if (last) {
      this.hits = last.hits;
      if (last.beats !== this.beats) {
        this.keepPlace(() => {
          this.beats = last.beats;
        });
      }
    }
    this.changed();
  }

  clear() {
    if (!this.hits.length) return;
    this.remember();
    this.hits = [];
    this.changed();
  }

  remember() {
    this.history.push({ hits: this.hits, beats: this.beats });
    if (this.history.length > 100) this.history.shift();
  }

  // ---------- settings ----------

  setBpm(bpm) {
    bpm = Math.min(220, Math.max(40, Math.round(bpm)));
    if (bpm === this.bpm) return;
    this.keepPlace(() => {
      this.bpm = bpm;
    });
    this.changed();
  }

  // A longer loop repeats what's there to fill it; a shorter one drops the end.
  setBeats(beats) {
    if (beats === this.beats) return;
    this.remember();
    const old = this.beats;
    if (beats > old && beats % old === 0) {
      const copies = [];
      for (let k = 1; k < beats / old; k++) for (const h of this.hits) copies.push({ t: h.t + k * old, sound: h.sound });
      this.hits = [...this.hits, ...copies];
    } else if (beats < old) {
      this.hits = this.hits.filter((h) => h.t < beats - 1e-6);
    }
    this.keepPlace(() => {
      this.beats = beats;
    });
    this.changed();
  }

  setSnap(snap) {
    if (snap in SNAPS) this.snap = snap;
    this.changed();
  }

  setClick(on) {
    this.click = on;
    this.changed();
  }

  // Changes tempo or length without jumping: stays on the same beat, and
  // re-books what was booked under the old timing.
  keepPlace(change) {
    if (!this.playing) return change();
    const now = this.board.ctx.currentTime;
    const beatsIn = (now - this.loopStart) / this.beatSeconds;
    change();
    const place = beatsIn < 0 ? beatsIn : beatsIn % this.beats;
    this.loopStart = now - place * this.beatSeconds;
    this.cancelBooked();
    this.bookedUntil = now;
    this.book();
  }

  // ---------- booking sounds on the audio clock ----------

  book() {
    const ctx = this.board.ctx;
    if (!ctx || !this.playing) return;
    const from = Math.max(this.bookedUntil, ctx.currentTime);
    const to = ctx.currentTime + LOOKAHEAD;
    if (to <= from) return;
    const beat = this.beatSeconds;
    const loop = this.loopSeconds;

    // Metronome: always during the count-in, and on every beat if Click is on.
    for (let n = Math.ceil((from - this.loopStart) / beat - 1e-9); this.loopStart + n * beat < to; n++) {
      if (n < -COUNT_IN_BEATS || (n >= 0 && !this.click)) continue;
      const when = this.loopStart + n * beat;
      if (when < from) continue;
      this.pending.push({ node: this.board.click(when, mod(n, 4) === 0), when });
    }

    // The loop's hits, on every time round.
    const first = Math.max(0, Math.floor((from - this.loopStart) / loop));
    const last = Math.floor((to - this.loopStart) / loop);
    for (let k = first; k <= last; k++) {
      for (const hit of this.hits) {
        const when = this.loopStart + k * loop + hit.t * beat;
        if (when < from || when >= to) continue;
        if (hit.skipAt !== undefined && Math.abs(when - hit.skipAt) < 1e-3) {
          delete hit.skipAt;
          continue;
        }
        const node = this.board.play(this.board.buffer(hit.sound), when);
        if (node) this.pending.push({ node, when });
        this.onHit?.(hit, when);
      }
    }

    this.bookedUntil = to;
    this.pending = this.pending.filter((p) => p.when > ctx.currentTime - 1);
  }

  cancelBooked() {
    const now = this.board.ctx?.currentTime ?? 0;
    for (const { node, when } of this.pending) {
      if (when > now) {
        try {
          node.stop();
        } catch {}
      }
    }
    this.pending = [];
  }

  // ---------- keeping the loop in this browser ----------

  save() {
    try {
      const hits = this.hits.filter((h) => SOUNDS[h.sound]).map(({ t, sound }) => ({ t, sound }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bpm: this.bpm, beats: this.beats, snap: this.snap, click: this.click, hits }));
    } catch {}
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      if (saved.bpm >= 40 && saved.bpm <= 220) this.bpm = saved.bpm;
      if (LENGTHS.includes(saved.beats)) this.beats = saved.beats;
      if (saved.snap in SNAPS) this.snap = saved.snap;
      this.click = saved.click !== false;
      this.hits = (saved.hits || []).filter((h) => SOUNDS[h.sound] && h.t >= 0 && h.t < this.beats);
    } catch {}
  }

  dispose() {
    clearInterval(this.timer);
    this.cancelBooked();
    this.playing = false;
  }
}
