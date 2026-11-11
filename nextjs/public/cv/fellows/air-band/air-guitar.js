// air-guitar.js — camera air guitar as a reusable module.
//
// It does NOT own the camera or the hand tracker. You run one MediaPipe HandLandmarker
// for the whole page and pass its landmarks in every frame with `guitar.update(hands)`.
// That way several instruments (guitar, piano, …) can share one camera, one model and
// one AudioContext on the same device. See README.md.

// ---------- Chords & songs ----------
export const TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4 (MIDI)

// Fret shapes, low E string → high E (null = string not played)
export const CHORDS = {
  Bm7: [null,2,4,2,3,2],
  Em7: [0,2,2,0,3,0],
  A7:  [null,0,2,0,2,0],
  G:   [3,2,0,0,0,3],
  D:   [null,null,0,2,3,2],
  C:   [null,3,2,0,1,0],
  Am:  [null,0,2,2,1,0],
  Dm:  [null,null,0,2,3,1],
  F:   [1,3,3,2,1,1],
  G7:  [3,2,0,0,0,1],
  Em:  [0,2,2,0,0,0],
};

// Each song is a lineup of chords. `chords` order = number keys 1, 2, 3…
// `fingers` (optional) = chord for 0..5 extended fingers on the chord hand (0 = fist, 5 = open hand).
export const SONGS = [
  { name: "Song 1", chords: ["Bm7","Em7","A7","G","D"] },
  { name: "Song 2", chords: ["C","Am","Dm","F","G","G7","Em"],
    fingers: ["C","Am","Dm","F","G","Em"] },
];

export const DEFAULT_SETTINGS = {
  strumHand: "right",   // which of the player's hands strums: "right" | "left"
  fretMode: true,       // the other hand picks chords by finger count
  capo: 0,              // 0..12
  lineY: 0.72,          // strum line height, 0 = top of frame, 1 = bottom
  stringsPos: 0.5,      // centre of the strings area, in display (mirrored) x, 0 = left of screen
  stringsWidth: 0.3,    // width of the strings area, fraction of the frame
  sensitivity: 1,       // higher = smaller dead zone and lower minimum strum speed
  area: [0, 1],         // only hands whose wrist is inside this display-x range belong to the guitar
};

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
/** Name of the chord that actually sounds with a capo, e.g. soundingName("Em", 2) → "F#m". */
export function soundingName(name, capo) {
  const m = name.match(/^([A-G]#?)(.*)$/);
  return NOTE_NAMES[(NOTE_NAMES.indexOf(m[1]) + capo) % 12] + m[2];
}

/** Count extended fingers (0..5) on one MediaPipe hand (21 landmarks). */
export function countFingers(lm) {
  const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  let n = 0;
  // index..pinky: extended if tip is farther from wrist than the PIP joint
  [[8,6],[12,10],[16,14],[20,18]].forEach(([tip, pip]) => { if (d(tip, 0) > d(pip, 0) * 1.15) n++; });
  // thumb: out if its tip is well away from the pinky knuckle (vs. palm width) and from the index knuckle
  if (d(4, 17) > d(5, 17) * 1.5 && d(4, 5) > d(0, 9) * 0.5) n++;
  return n;
}

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export class AirGuitar {
  /**
   * @param {object} [opts]
   * @param {AudioContext} [opts.audioContext] share one context with other instruments
   * @param {AudioNode} [opts.destination] where the guitar's output goes (e.g. a band mixer bus)
   * @param {Array} [opts.songs] chord lineups, defaults to SONGS
   * @param {object} [opts.settings] overrides for DEFAULT_SETTINGS
   * @param {(state) => void} [opts.onChange] called when song/chord changes ({song, chord, sounding})
   * @param {(e) => void} [opts.onStrum] called on every strum ({direction, velocity, chord})
   */
  constructor(opts = {}) {
    this.songs = opts.songs || SONGS;
    this.settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
    this.onChange = opts.onChange || (() => {});
    this.onStrum = opts.onStrum || (() => {});
    this._ctx = opts.audioContext || null;
    this._dest = opts.destination || null;
    this._bufCache = new Map();
    this._ringing = [];
    this._track = { sy: null, sx: null, side: null, edgeY: 0, edgeT: 0, lastStrum: 0, wentAround: false };
    this._fingerHold = { n: -1, frames: 0 };
    this._flash = null;
    this._hands = { strum: null, fret: null, all: [] };
    this.songIndex = 0;
    this.chord = null;
    this.setSong(0);
  }

  // ----- songs & chords -----
  get song() { return this.songs[this.songIndex]; }
  get chordNames() { return this.song.chords; }
  get fingerChords() { return this.song.fingers || this.song.chords.slice(0, 6); }

  setSong(i) {
    this.songIndex = Math.max(0, Math.min(this.songs.length - 1, i));
    this.chord = null;
    this.setChord(this.chordNames[0]);
  }
  setChord(name) {
    if (!name || name === this.chord || !CHORDS[name]) return;
    this.chord = name;
    this.onChange({ song: this.song, chord: name, sounding: soundingName(name, this.settings.capo) });
  }
  set(settings) {
    const capoChanged = "capo" in settings && settings.capo !== this.settings.capo;
    Object.assign(this.settings, settings);
    if (capoChanged) this.onChange({ song: this.song, chord: this.chord, sounding: soundingName(this.chord, this.settings.capo) });
  }

  // ----- audio -----
  /** Create the audio graph. Call from a user gesture (click/key) if you didn't pass an AudioContext. */
  ensureAudio() {
    if (this._input) return;
    const ctx = this._ctx || (this._ctx = new AudioContext());
    if (ctx.state === "suspended") ctx.resume();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    const body = ctx.createBiquadFilter(); // guitar body warmth
    body.type = "peaking"; body.frequency.value = 110; body.Q.value = 1; body.gain.value = 5;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass"; tone.frequency.value = 5500;
    const wet = ctx.createGain(); wet.gain.value = 0.18; // small room reverb via feedback delays
    [0.029, 0.037, 0.043].forEach(t => {
      const d = ctx.createDelay(); d.delayTime.value = t;
      const fb = ctx.createGain(); fb.gain.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2500;
      tone.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet);
    });
    this.output = ctx.createGain(); this.output.gain.value = 0.8; // guitar volume
    body.connect(tone); tone.connect(comp); wet.connect(comp); comp.connect(this.output);
    this.output.connect(this._dest || ctx.destination);
    this._input = body;
  }

  // Karplus-Strong plucked string, cached per note
  _stringBuffer(midi) {
    if (this._bufCache.has(midi)) return this._bufCache.get(midi);
    const ctx = this._ctx, sr = ctx.sampleRate, len = Math.floor(sr * 3.0);
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const N = sr / freq, Ni = Math.floor(N), frac = N - Ni;
    const out = new Float32Array(len);
    let prev = 0; // excitation: softened noise burst
    for (let i = 0; i < Ni + 1; i++) { prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5; out[i] = prev; }
    const decay = 0.996 + Math.min(0.0035, (110 / freq) * 0.002); // low strings ring longer
    for (let i = Ni + 1; i < len; i++) {
      const a = out[i - Ni], b = out[i - Ni - 1], c = out[i - Ni - 2] ?? b;
      out[i] = decay * (0.5 * (a * (1 - frac) + b * frac) + 0.5 * (b * (1 - frac) + c * frac));
    }
    let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    for (let i = 0; i < len; i++) out[i] /= peak || 1;
    const buf = ctx.createBuffer(1, len, sr);
    buf.copyToChannel(out, 0);
    this._bufCache.set(midi, buf);
    return buf;
  }

  /** Play the current chord. direction: "down" | "up", velocity 0..1. */
  strum(direction = "down", velocity = 0.7) {
    this.ensureAudio();
    const ctx = this._ctx, capo = this.settings.capo;
    let strings = CHORDS[this.chord].map((f, i) => ({ m: f == null ? null : TUNING[i] + capo + f, i })).filter(s => s.m != null);
    if (direction === "up") strings = strings.reverse().slice(0, 4); // upstrokes hit treble strings
    const now = ctx.currentTime;
    while (this._ringing.length) { // choke the previous strum
      const g = this._ringing.pop(); g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, 0.03);
    }
    const spread = Math.max(0.006, 0.03 - velocity * 0.02); // faster strum = tighter
    const vol = 0.15 + 0.35 * velocity;
    strings.forEach((s, k) => {
      const src = ctx.createBufferSource(); src.buffer = this._stringBuffer(s.m);
      const g = ctx.createGain(); g.gain.value = vol * (direction === "up" ? 0.8 : 1) * (0.85 + Math.random() * 0.3);
      const pan = ctx.createStereoPanner(); pan.pan.value = (s.i - 2.5) / 8;
      src.connect(g); g.connect(pan); pan.connect(this._input);
      src.start(now + k * spread * (0.8 + Math.random() * 0.4));
      this._ringing.push(g);
    });
    this._flash = { t: performance.now(), direction, velocity };
    this.onStrum({ direction, velocity, chord: this.chord });
  }

  // ----- vision -----
  /**
   * Feed one frame of hand landmarks.
   * @param {Array<Array<{x,y,z}>>} hands  MediaPipe HandLandmarker `result.landmarks` (raw camera coords, NOT mirrored)
   * @param {number} [now] ms timestamp, defaults to performance.now()
   */
  update(hands, now = performance.now()) {
    const [a0, a1] = this.settings.area;
    const mine = (hands || []).filter(h => { const x = 1 - h[0].x; return x >= a0 && x <= a1; });
    let strum = null, fret = null;
    if (mine.length === 1) strum = mine[0];
    else if (mine.length >= 2) {
      const [a, b] = mine; // display is mirrored: displayX = 1 - x
      const aIsRight = (1 - a[0].x) > (1 - b[0].x);
      strum = (aIsRight === (this.settings.strumHand === "right")) ? a : b;
      fret = strum === a ? b : a;
    }
    this._hands = { strum, fret, all: mine };

    if (fret && this.settings.fretMode) {
      const n = countFingers(fret), hold = this._fingerHold;
      if (n === hold.n) hold.frames++; else { hold.n = n; hold.frames = 1; }
      if (hold.frames >= 3) this.setChord(this.fingerChords[n]); // steady for 3 frames → no flicker
    }
    this._updateStrum(strum ? strum[8].y : null, now, strum ? 1 - strum[8].x : 0.5); // index fingertip
  }

  _zoneHalf() { return 0.06 / this.settings.sensitivity; }
  _stringsRange() { const { stringsPos: c, stringsWidth: w } = this.settings; return [c - w / 2, c + w / 2]; }

  // Strum detection with a dead zone around the line (hysteresis): a strum fires only when the
  // fingertip goes all the way from one side of the zone to the other, fast enough, while inside
  // the strings area. Going around the side of the strings moves it across silently (a "ghost" stroke).
  _updateStrum(rawY, now, rawX) {
    const t = this._track;
    if (rawY == null) { t.sy = t.sx = null; t.side = null; return; }
    t.sy = t.sy == null ? rawY : t.sy + 0.65 * (rawY - t.sy); // light smoothing vs. jitter
    t.sx = t.sx == null ? rawX : t.sx + 0.65 * (rawX - t.sx);
    const [x0, x1] = this._stringsRange();
    if (t.sx < x0 || t.sx > x1) t.wentAround = true;
    const y = t.sy, line = this.settings.lineY, h = this._zoneHalf();
    const side = y < line - h ? "above" : y > line + h ? "below" : null;
    if (!side) return;
    if (t.side && side !== t.side && !t.wentAround) {
      const speed = Math.abs(y - t.edgeY) / Math.max(0.001, (now - t.edgeT) / 1000);
      if (speed > 0.5 / this.settings.sensitivity && now - t.lastStrum > 50) {
        this.strum(side === "below" ? "down" : "up", Math.min(1, speed / 4));
        t.lastStrum = now;
      }
    }
    t.side = side; t.edgeY = y; t.edgeT = now;
    t.wentAround = t.sx < x0 || t.sx > x1;
  }

  /**
   * Draw the strings area and the guitar's hands. Draws in raw camera coordinates, so mirror the
   * canvas the same way as the video (e.g. CSS transform: scaleX(-1)).
   */
  draw(g, W, H, now = performance.now()) {
    const glow = this._flash ? Math.max(0, 1 - (now - this._flash.t) / 250) : 0;
    const L = this.settings.lineY * H, zh = this._zoneHalf() * H;
    const [x0, x1] = this._stringsRange(), left = (1 - x1) * W, right = (1 - x0) * W;
    g.fillStyle = "rgba(0,229,255,0.12)"; g.fillRect(left, L - zh, right - left, zh * 2);
    g.strokeStyle = glow > 0 ? `rgba(255,179,0,${0.5 + glow / 2})` : "rgba(0,229,255,0.8)";
    g.lineWidth = 4 + glow * 10;
    g.beginPath(); g.moveTo(left, L); g.lineTo(right, L); g.stroke();
    g.lineWidth = 3; g.strokeStyle = "rgba(0,229,255,0.6)";
    g.beginPath(); g.moveTo(left, L - zh); g.lineTo(left, L + zh); g.moveTo(right, L - zh); g.lineTo(right, L + zh); g.stroke();
    for (const lm of this._hands.all) {
      const isStrum = lm === this._hands.strum;
      g.strokeStyle = isStrum ? "#00e5ff" : "#ffb300"; g.lineWidth = 3;
      for (const [a, b] of HAND_CONNECTIONS) { g.beginPath(); g.moveTo(lm[a].x * W, lm[a].y * H); g.lineTo(lm[b].x * W, lm[b].y * H); g.stroke(); }
      g.fillStyle = "#fff";
      for (const p of lm) { g.beginPath(); g.arc(p.x * W, p.y * H, 3, 0, 7); g.fill(); }
      if (isStrum) { g.fillStyle = "#00e5ff"; g.beginPath(); g.arc(lm[8].x * W, lm[8].y * H, 12, 0, 7); g.fill(); }
    }
  }
}
