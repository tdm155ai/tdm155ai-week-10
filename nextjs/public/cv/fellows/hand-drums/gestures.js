// Turns MediaPipe hand landmarks into drum gestures.
// Coordinates arrive already mirrored (x flipped) so "right" means the player's right on screen.
// Distances are measured in "hand sizes" (wrist to middle knuckle) so it works at any distance from the camera.

export const settings = {
  sensitivity: 1.0, // higher = lighter taps register
};

export const STICK_START = 1.8, STICK_TRAVEL = 0.12, PALM_START = 3.0, PALM_TRAVEL = 0.5, HIT_GAP = 90;
export const TOUCH_ON = 0.22, TOUCH_OFF = 0.45, TOUCH_FRAMES = 3; // thumb-to-index distance, in hand sizes
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]]; // [tip, pip]

class Hand {
  constructor(id) {
    this.id = id;
    this.pose = 'none';
    this.rawPose = 'none';
    this.rawCount = 0;
    this.pinched = false;
    this.pinchFrames = 0;
    this.hist = []; // {t, x, y} in hand sizes (px / size)
    this.lastSeen = 0;
    this.pointUntil = 0;
    this.palmUntil = 0;
    this.descending = false;
    this.peak = 0;
    this.descStart = 0;
    this.lastHit = 0;
    this.fistSince = 0;
    this.wrist = { x: 0, y: 0 };
  }
}

export class GestureEngine {
  constructor() {
    this.slots = [new Hand(0), new Hand(1)];
    this.lastSwipe = 0;
    this.lastPinch = 0;
  }

  // hands: array of landmark arrays (21 points, x/y in 0..1 of the *unmirrored* video)
  update(hands, W, H, now) {
    const events = [];
    const pts = hands.map((lm) => lm.map((p) => ({ x: (1 - p.x) * W, y: p.y * H, z: (p.z || 0) * W }))); // pixel coords, mirrored
    const used = new Set();
    const out = [];
    // match detections to slots by wrist proximity
    const order = pts.map((p, i) => ({ i, w: p[0] }));
    const assigned = new Map();
    for (const slot of this.slots) {
      let best = -1, bd = Infinity;
      for (const o of order) {
        if (used.has(o.i)) continue;
        const d = Math.hypot(o.w.x - slot.wrist.x, o.w.y - slot.wrist.y);
        if (now - slot.lastSeen < 400 && d < bd) { bd = d; best = o.i; }
      }
      if (best >= 0 && bd < 0.35 * W) { used.add(best); assigned.set(slot, best); }
    }
    for (const o of order) {
      if (used.has(o.i)) continue;
      const free = this.slots.find((s) => !assigned.has(s));
      if (free) { assigned.set(free, o.i); used.add(o.i); }
    }
    for (const slot of this.slots) {
      if (!assigned.has(slot)) {
        if (slot.pose !== 'none' && now - slot.lastSeen > 250) this.#lose(slot);
        continue;
      }
      const p = pts[assigned.get(slot)];
      out.push(this.#hand(slot, p, W, H, now, events));
    }
    return { events, hands: out };
  }

  #lose(slot) {
    slot.armed = false; slot.openFrames = 0; slot.touchFrames = 0; slot.tracked = 0; slot.pose = 'none'; slot.rawPose = 'none'; slot.hist = []; slot.descending = false; slot.pinched = false; slot.fistSince = 0;
  }

  #hand(h, p, W, H, now, events) {
    const d = (a, b) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
    const size = Math.max(d(0, 9), 20);
    h.lastSeen = now;
    h.wrist = p[0];

    const ext = FINGERS.map(([tip, pip]) => d(tip, 0) > d(pip, 0) * 1.12);
    const [iExt, mExt, rExt, pExt] = ext;
    const n = ext.filter(Boolean).length;

    // closed hand: average fingertip distance from the wrist, in hand sizes (open hand is about 2, a fist about 1.1)
    const curl = (d(8, 0) + d(12, 0) + d(16, 0) + d(20, 0)) / 4 / size;
    // a pinch has the index tip reaching out; a fist doesn't
    const isFist = (d(12, 0) + d(16, 0) + d(20, 0)) / 3 / size < 1.5 && d(8, 0) / size < 1.3;

    // pinch with hysteresis; a closed fist doesn't count
    // thumb tip (4) and index tip (8) must actually touch: distance in 3D (x, y and depth), in hand sizes
    const pd = Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y, p[4].z - p[8].z) / size;
    const pd2 = Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) / size; // as seen in the picture (depth is noisy)
    h.tracked = (h.tracked || 0) + 1;
    // both the picture and the depth estimate must say the fingertips touch, for several frames in a row
    const touching = pd2 < TOUCH_ON && pd < TOUCH_ON * 1.4 && !isFist;
    h.touchFrames = touching ? (h.touchFrames || 0) + 1 : 0;
    if (!h.pinched && h.touchFrames >= TOUCH_FRAMES) h.pinched = true;
    else if (h.pinched && (pd2 > TOUCH_OFF || isFist)) h.pinched = false;
    // a pinch only counts after this hand has been seen clearly open (fingers apart) for a few frames
    h.openFrames = pd2 > TOUCH_OFF ? (h.openFrames || 0) + 1 : (h.pinched ? 0 : h.openFrames || 0);
    if (h.openFrames >= 3) h.armed = true;

    let raw;
    if (h.pinched) raw = 'pinch';
    else if (isFist) raw = 'fist';
    else if (n === 4) raw = 'palm';
    else if (iExt && !rExt && !pExt) raw = 'point';
    else raw = 'other';

    // two consecutive frames to change pose (stops flicker)
    if (raw === h.rawPose) h.rawCount++; else { h.rawPose = raw; h.rawCount = 1; }
    const prev = h.pose;
    if (h.rawCount >= 2 || h.pose === 'none' || raw === 'pinch') h.pose = raw;
    if (h.pose === 'point') h.pointUntil = now + 350;
    if (h.pose === 'palm') h.palmUntil = now + 180;

    // pinch edge
    if (h.pose === 'pinch' && prev !== 'pinch' && h.armed && now - this.lastPinch > 900) {
      this.lastPinch = now; h.armed = false; h.openFrames = 0;
      events.push({ type: 'pinch', hand: h.id });
    }

    // fist
    if (h.pose === 'fist') { if (!h.fistSince) h.fistSince = now; } else h.fistSince = 0;

    // tracked point: fingertip for sticks, palm centre for palms
    // (stick mode stays on briefly after the finger curls into a tap, because a tap bends the finger)
    const mode = (h.pose === 'palm' && now < h.palmUntil) ? 'palm' : now < h.pointUntil ? 'stick' : now < h.palmUntil ? 'palm' : null;
    const tp = mode === 'stick' ? p[8] : p[9];
    if (h.hist.length && h.hist[h.hist.length - 1].mode !== mode) h.hist = []; // never mix two tracked points
    h.hist.push({ t: now, x: tp.x / size, y: tp.y / size, mode });
    while (h.hist.length > 2 && now - h.hist[0].t > 400) h.hist.shift();
    const vel = this.#velocity(h, now, 60);
    h.vy = vel ? vel.vy : 0;
    h.mode = mode;

    if (mode && vel) {
      const s = settings.sensitivity;
      const start = (mode === 'stick' ? STICK_START : PALM_START) / s; // downward speed (hand sizes per second) that begins a stroke
      const travel = (mode === 'stick' ? STICK_TRAVEL : PALM_TRAVEL) / s; // how far it must fall (hand sizes)
      const y = tp.y / size;
      const vertical = vel.vy > 1.0 * Math.abs(vel.vx);
      if (!h.descending) {
        if (vertical && vel.vy > start && now - h.lastHit > HIT_GAP) {
          h.descending = true; h.peak = vel.vy; h.descStart = now; h.startY = h.hist.length > 2 ? h.hist[Math.max(0, h.hist.length - 3)].y : y;
        }
      } else {
        h.peak = Math.max(h.peak, vel.vy);
        // the stroke ends when it slows to under 45% of its peak speed or turns around
        const ended = vel.vy < h.peak * 0.45;
        if (ended || now - h.descStart > 400) {
          h.descending = false;
          if (ended && y - h.startY > travel) {
            h.lastHit = now;
            events.push({
              type: 'hit', hand: h.id, kind: mode,
              x: tp.x / W, y: tp.y / H,
              vel: Math.min(1, 0.3 + (h.peak - start) / 10),
            });
          }
        }
      }
    } else if (!mode) h.descending = false;

    // swipe with an open palm
    if (h.pose === 'palm' && now - this.lastSwipe > 800) {
      const w = this.#window(h, now, 280);
      if (w) {
        const dx = w.dx, dy = w.dy;
        if (Math.abs(dx) > 2.4 / Math.sqrt(settings.sensitivity) && Math.abs(dx) > 2.2 * Math.abs(dy)) {
          this.lastSwipe = now;
          h.descending = false;
          h.lastHit = now + 200; // a swipe is not a drum hit
          events.push({ type: 'swipe', dir: dx > 0 ? 1 : -1, hand: h.id });
        }
      }
    }

    return {
      id: h.id, pose: h.pose,
      pts: p.map((q) => ({ x: q.x / W, y: q.y / H })),
      palm: { x: p[9].x / W, y: p[9].y / H },
      tip: { x: p[8].x / W, y: p[8].y / H },
      fistMs: h.fistSince ? now - h.fistSince : 0,
      size: size / W, pd: pd2, curl, vy: h.vy || 0, mode: h.mode, start: (h.mode === 'palm' ? PALM_START : STICK_START) / settings.sensitivity,
    };
  }

  #velocity(h, now, span) {
    const hist = h.hist;
    if (hist.length < 2) return null;
    const last = hist[hist.length - 1];
    let a = hist[0];
    for (let i = hist.length - 2; i >= 0; i--) { a = hist[i]; if (last.t - hist[i].t >= span) break; }
    const dt = (last.t - a.t) / 1000;
    if (dt < 0.03) return null;
    return { vx: (last.x - a.x) / dt, vy: (last.y - a.y) / dt };
  }

  #window(h, now, span) {
    const hist = h.hist;
    if (hist.length < 3) return null;
    const last = hist[hist.length - 1];
    let a = null;
    for (const s of hist) if (last.t - s.t <= span) { a = s; break; }
    if (!a || a === last) return null;
    return { dx: last.x - a.x, dy: last.y - a.y };
  }
}

// "Enter the field" trigger: a pointed fingertip that moves into a pad plays it once.
// It must have been outside first (a hand that appears inside a pad doesn't fire). Leaving the pad
// (for two frames, so a single dropped frame doesn't count) re-arms it, and entering again plays it again.
export class FieldTrigger {
  constructor() { this.state = new Map(); } // hand id -> {zone, armed, out}
  // zone: pad the fingertip is inside (-1 none). near: pad it is inside or within a small margin of (-1 none).
  // Only leaving past the margin re-arms, so tracking jitter on a pad's edge can't chatter.
  update(id, pointing, zone, near = zone) {
    let s = this.state.get(id);
    if (!s) { s = { zone: -2, armed: false, out: 0 }; this.state.set(id, s); }
    if (!pointing) { s.zone = -2; return -1; }
    if (s.zone === -2) { s.zone = zone; s.armed = zone === -1; s.out = 0; return -1; }
    if (zone >= 0) {
      s.out = 0;
      if (zone !== s.zone || s.armed) {
        const fire = (s.armed || s.zone !== -1) ? zone : -1; // sliding from one pad straight into the next also counts
        s.zone = zone; s.armed = false;
        return fire;
      }
      return -1;
    }
    if (near === -1) { if (++s.out >= 2) { s.zone = -1; s.armed = true; } } else s.out = 0;
    return -1;
  }
}
