// Air drums player: wraps the Hand drums gestures + sounds (js/hand-drums/) so it fits one player's zone.
// Four pads across the top of the player's column. Point into a pad or tap down with an open palm;
// swipe an open palm to change drums; pinch to record a loop, pinch again to close it.
import { play, KITS, useAudio } from "./hand-drums/audio.js";
import { GestureEngine, FieldTrigger, settings as gestureSettings } from "./hand-drums/gestures.js";
import { HAND_LINKS, label } from "./common.js";

const MAX_LOOPS = 4;      // per player
const EDGE_MARGIN = 12;   // px a fingertip must leave a pad by before it can play it again
const LOOP_COLORS = ["#ff7a59", "#f6c344", "#7bd88f", "#6cc5ff", "#c58bff", "#ff8fc7", "#9be3d4", "#d9d96b"];

let hookedTo = null;
function hookAudio(engine) { if (hookedTo !== engine) { useAudio(engine.ac, engine.master); hookedTo = engine; } }

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** One drummer. `settings` is shared by every drummer: { stickMode: "enter" | "tap", sensitivity }. */
export class DrumPlayer {
  constructor(engine, settings) {
    hookAudio(engine);
    this.ac = engine.ac; this.s = settings;
    this.ge = new GestureEngine(); this.field = new FieldTrigger();
    this.kit = 0; this.hands = []; this.flashes = [0, 0, 0, 0]; this.ripples = [];
    this.banner = { text: "", t: 0 }; this.msg = { text: "", t: 0 };
    this.recording = null; this.loops = []; this.nextId = 1;
    this.zone = [0, 1]; this.W = 1280; this.H = 720; this.lastHit = 0;
    this.text = ""; this.note = ""; this.active = false;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  get k() { return KITS[this.kit]; }

  // ----- layout, in display (as-seen) pixels -----
  pads() {
    const { zone: z, W, H } = this;
    return { x: z[0] * W + 12, y: H * 0.1, w: (z[1] - z[0]) * W - 24, h: H * 0.26 };
  }
  padAt(x, y, margin = 0) {
    const pa = this.pads(), zw = pa.w / 4;
    if (y < pa.y - margin || y > pa.y + pa.h + margin) return -1;
    for (let i = 0; i < 4; i++) {
      const x0 = pa.x + i * zw + 4, x1 = x0 + zw - 8;
      if (x >= x0 - margin && x <= x1 + margin) return i;
    }
    return -1;
  }

  // ----- playing -----
  hit(kind, pad, vel, x, y) {
    const voice = this.k.zones[pad][kind];
    play(voice, 0, vel);
    this.flashes[pad] = 1;
    this.lastHit = performance.now();
    if (x != null) this.ripples.push({ x, y, t: performance.now(), color: this.k.color, kind });
    if (this.recording) this.recording.events.push({ t: this.ac.currentTime - this.recording.start, voice, vel });
  }
  /** Keyboard / button hit on pad 0..3. */
  hitPad(pad, kind = "stick", vel = 0.8) {
    const pa = this.pads(), zw = pa.w / 4;
    this.hit(kind, pad, vel, pa.x + (pad + 0.5) * zw, pa.y + pa.h / 2);
  }
  changeKit(dir) {
    this.kit = (this.kit + dir + KITS.length) % KITS.length;
    this.banner = { text: this.k.name, t: performance.now() };
  }
  say(text) { this.msg = { text, t: performance.now() }; }

  // ----- loops -----
  toggleRecord() {
    const now = this.ac.currentTime;
    if (!this.recording) {
      if (this.loops.length >= MAX_LOOPS) { this.say(`${MAX_LOOPS} loops is the limit — clear them first`); return; }
      this.recording = { start: now, events: [] };
      return;
    }
    const dur = now - this.recording.start, ev = this.recording.events;
    this.recording = null;
    if (!ev.length || dur < 0.4) { this.say("Empty loop discarded"); return; }
    const id = this.nextId++;
    this.loops.push({ id, events: ev, dur, color: LOOP_COLORS[(id - 1) % LOOP_COLORS.length], kitName: this.k.name, origin: now, cycleStart: now, idx: 0 });
    this.say(`Loop ${id} playing · ${dur.toFixed(1)} s`);
  }
  clearLoops() { this.loops = []; this.recording = null; }
  schedule() {
    const now = this.ac.currentTime, ahead = now + 0.15;
    for (const l of this.loops) {
      for (let guard = 0; guard < 200; guard++) {
        if (l.idx >= l.events.length) {
          if (l.cycleStart + l.dur > ahead) break;
          l.cycleStart += l.dur; l.idx = 0; continue;
        }
        const e = l.events[l.idx], t = l.cycleStart + e.t;
        if (t > ahead) break;
        if (t >= now - 0.03) play(e.voice, t, e.vel);
        l.idx++;
      }
    }
    if (this.recording && now - this.recording.start > 30) this.toggleRecord();
  }

  // ----- every frame -----
  /** hands: [{ lm }] for this player's zone only (raw, unmirrored camera coords). */
  update({ hands, W, H, now, zone }) {
    this.W = W; this.H = H; this.zone = zone;
    gestureSettings.sensitivity = this.s.sensitivity;
    const out = this.ge.update(hands.map(h => h.lm), W, H, now); // its output is mirrored (display) coords
    this.hands = out.hands;
    for (const e of out.events) {
      if (e.type === "hit") {
        if (e.kind === "stick" && this.s.stickMode === "enter") continue;
        const x = e.x * W, y = e.y * H, pa = this.pads();
        this.hit(e.kind, Math.max(0, Math.min(3, Math.floor((x - pa.x) / (pa.w / 4)))), e.vel, x, y);
      } else if (e.type === "swipe") this.changeKit(e.dir);
      else if (e.type === "pinch") this.toggleRecord();
    }
    // a pointed fingertip that moves into a pad plays it once
    const seen = new Set(), grow = (this.s.sensitivity - 1) * 30;
    for (const h of this.hands) {
      seen.add(h.id);
      const x = h.tip.x * W, y = h.tip.y * H;
      const pointing = this.s.stickMode === "enter" && (h.pose === "point" || h.mode === "stick");
      const fire = this.field.update(h.id, pointing, this.padAt(x, y, grow), this.padAt(x, y, grow + EDGE_MARGIN));
      h.inPad = pointing ? this.padAt(x, y, grow) : -1;
      if (fire >= 0) this.hit("stick", fire, 0.85, x, y);
    }
    for (const id of this.field.state.keys()) if (!seen.has(id)) this.field.update(id, false, -1, -1);

    this.text = `🥁 ${this.k.name}` + (this.recording ? `  ● REC ${(this.ac.currentTime - this.recording.start).toFixed(1)}s` : "");
    this.note = this.loops.length ? `${this.loops.length} loop${this.loops.length > 1 ? "s" : ""}` : "";
    this.active = performance.now() - this.lastHit < 140;
  }

  // ----- drawing (canvas is mirrored by CSS, so display x → canvas x = W - x) -----
  draw(ctx, W, H, zone, showSkel, now) {
    const pa = this.pads(), zw = pa.w / 4, k = this.k;
    for (let i = 0; i < 4; i++) {
      this.flashes[i] *= 0.9;
      const f = this.flashes[i], x = pa.x + i * zw + 4, w = zw - 8, cx = W - x - w;
      ctx.fillStyle = hexA(k.color, 0.1 + f * 0.5);
      ctx.beginPath(); ctx.roundRect(cx, pa.y, w, pa.h, 14); ctx.fill();
      const touched = this.hands.some(h => h.inPad === i);
      ctx.strokeStyle = touched ? "#fff" : hexA(k.color, 0.45 + f * 0.5); ctx.lineWidth = touched ? 3 : 2; ctx.stroke();
      const fs = Math.round(Math.max(10, Math.min(16, w / 5))); // shrink labels in narrow columns
      label(ctx, k.zones[i].label, cx + w / 2, pa.y + 26, "rgba(255,255,255,.9)", `700 ${fs}px system-ui`);
      if (w > 70) label(ctx, "point · palm", cx + w / 2, pa.y + 46, "rgba(255,255,255,.5)", "12px system-ui");
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i], a = (now - r.t) / 450;
      if (a >= 1) { this.ripples.splice(i, 1); continue; }
      ctx.strokeStyle = hexA(r.color, 1 - a); ctx.lineWidth = 4 * (1 - a) + 1;
      ctx.beginPath(); ctx.arc(W - r.x, r.y, (r.kind === "palm" ? 40 : 18) + a * 70, 0, 7); ctx.stroke();
    }
    for (const h of this.hands) {
      const P = h.pts.map(p => ({ x: W - p.x * W, y: p.y * H }));
      if (showSkel) {
        ctx.strokeStyle = hexA(k.color, 0.85); ctx.lineWidth = 3;
        ctx.beginPath(); for (const [a, b] of HAND_LINKS) { ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); } ctx.stroke();
      }
      if (h.pose === "point") { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P[8].x, P[8].y, 14, 0, 7); ctx.stroke(); }
      if (h.pose === "pinch") {
        ctx.strokeStyle = "#ff3b4a"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(P[4].x, P[4].y); ctx.lineTo(P[8].x, P[8].y); ctx.stroke();
        label(ctx, "PINCH", (P[4].x + P[8].x) / 2, Math.min(P[4].y, P[8].y) - 20, "#ff3b4a", "800 20px system-ui");
      }
    }
    // centre of this column, in canvas coords
    const mid = W - (zone[0] + zone[1]) / 2 * W;
    const ba = 1 - (now - this.banner.t) / 900;
    const bannerPx = Math.round(Math.min(56, (zone[1] - zone[0]) * W / 6));
    if (ba > 0) { ctx.globalAlpha = ba; label(ctx, this.banner.text, mid, H * 0.48, k.color, `800 ${bannerPx}px system-ui`); ctx.globalAlpha = 1; }
    const ta = 1 - (now - this.msg.t) / 2200;
    if (ta > 0) { ctx.globalAlpha = Math.min(1, ta * 2); label(ctx, this.msg.text, mid, H * 0.58, "#fff", "600 16px system-ui"); ctx.globalAlpha = 1; }
    // loop strip along the bottom of the column
    if (this.loops.length || this.recording) {
      const colW = (zone[1] - zone[0]) * W, cw = Math.min(130, (colW - 24) / MAX_LOOPS - 8), ch = 44, y = H - ch - 14;
      this.loops.forEach((l, i) => {
        const dx = zone[0] * W + 12 + i * (cw + 8), cx = W - dx - cw;
        ctx.fillStyle = hexA(l.color, 0.3); ctx.beginPath(); ctx.roundRect(cx, y, cw, ch, 10); ctx.fill();
        ctx.strokeStyle = l.color; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = l.color;
        for (const e of l.events) ctx.fillRect(W - (dx + 6 + (e.t / l.dur) * (cw - 12)) - 1, y + 22, 2, ch - 28);
        const ph = (((this.ac.currentTime - l.origin) % l.dur) + l.dur) % l.dur / l.dur;
        ctx.fillStyle = "#fff"; ctx.fillRect(W - (dx + 6 + ph * (cw - 12)) - 1, y + 20, 2, ch - 24);
        label(ctx, `Loop ${l.id} · ${l.dur.toFixed(1)}s`, cx + cw / 2, y + 11, "#fff", "600 11px system-ui");
      });
      if (this.recording) label(ctx, "● REC — pinch to close", mid, y - 14, "#ff3b4a", "700 14px system-ui");
    }
  }

  stop() { this.recording = null; }
  dispose() { clearInterval(this.timer); this.loops = []; this.recording = null; }
}
