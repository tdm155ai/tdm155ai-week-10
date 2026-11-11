// Filter player: their fingers sweep a DJ filter on the whole band's sound.
// Right hand = low-pass (pinch thumb + index to cut the highs), left hand = high-pass (pinch to cut the bass).
// Raising a hand adds resonance. With no hands in view the filter glides back fully open.
import { drawHand, label, GOLD } from "./common.js";

const LP_MIN = 150, LP_MAX = 20000;   // low-pass cutoff range (Hz)
const HP_MIN = 20, HP_MAX = 3000;     // high-pass cutoff range (Hz)
const N = 96;                         // points on the drawn response curve

const clamp01 = v => Math.max(0, Math.min(1, v));
const fmt = f => f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + "k" : Math.round(f) + "";

/** `settings` is shared by every filter player: { maxQ }. All filter players steer the same band filter. */
export class FilterPlayer {
  constructor(engine, settings) {
    this.e = engine; this.s = settings;
    this.lpT = 1; this.hpT = 1; this.q = 0.7;   // 1 = fully open
    this.view = [];
    this.text = ""; this.note = ""; this.active = false;
    this.freqs = new Float32Array(N).map((_, i) => 30 * Math.pow(18000 / 30, i / (N - 1)));
    this.magLp = new Float32Array(N); this.magHp = new Float32Array(N); this.phase = new Float32Array(N);
  }
  get lpHz() { return LP_MIN * Math.pow(LP_MAX / LP_MIN, this.lpT); }
  get hpHz() { return HP_MAX * Math.pow(HP_MIN / HP_MAX, this.hpT); }

  /** hands: [{ lm }] for this player's zone only (raw, unmirrored camera coords). */
  update({ hands, W, H }) {
    // left/right by where the hands are on screen; a lone hand drives the low-pass
    const hs = hands.slice(0, 2).map(h => ({ lm: h.lm, dx: 1 - h.lm[0].x })).sort((a, b) => a.dx - b.dx);
    const roles = hs.length === 2 ? ["hp", "lp"] : ["lp"];
    let lpTarget = 1, hpTarget = 1, qTarget = 0.7;
    this.view = hs.map((h, i) => {
      const P = h.lm.map(l => ({ x: l.x * W, y: l.y * H }));
      const d = (a, b) => Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y);
      const size = Math.max(d(0, 9), 10);
      const open = clamp01((d(4, 8) / size - 0.25) / 0.85);          // pinched 0 … spread 1
      const height = clamp01((0.8 - h.lm[9].y) / 0.5);                // low 0 … high 1
      if (roles[i] === "lp") lpTarget = open; else hpTarget = open;
      qTarget = Math.max(qTarget, 0.7 + height * (this.s.maxQ - 0.7));
      return { P, role: roles[i], open };
    });
    // smooth, and glide back open when hands leave
    const k = hs.length ? 0.35 : 0.08;
    this.lpT += k * (lpTarget - this.lpT);
    this.hpT += k * (hpTarget - this.hpT);
    this.q += 0.2 * (qTarget - this.q);
    const t = this.e.ac.currentTime;
    this.e.lp.frequency.setTargetAtTime(this.lpHz, t, 0.03);
    this.e.hp.frequency.setTargetAtTime(this.hpHz, t, 0.03);
    this.e.lp.Q.setTargetAtTime(this.q, t, 0.05);
    this.e.hp.Q.setTargetAtTime(this.q, t, 0.05);

    const parts = [];
    if (this.hpT < 0.97) parts.push(`HP ${fmt(this.hpHz)}`);
    if (this.lpT < 0.97) parts.push(`LP ${fmt(this.lpHz)}`);
    this.active = parts.length > 0;
    this.text = hands.length ? "🎛️" : "🎛️ Show your hands";
    this.note = parts.length ? parts.join(" · ") : (hands.length ? "open" : "");
  }

  draw(ctx, W, H, zone, showSkel) {
    for (const v of this.view) {
      if (showSkel) drawHand(ctx, v.P, "rgba(255,255,255,.5)");
      const a = v.P[4], b = v.P[8], col = v.role === "lp" ? GOLD : "#6cc5ff";
      ctx.strokeStyle = col; ctx.lineWidth = 3 + (1 - v.open) * 6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      for (const p of [a, b]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 7); ctx.fill(); }
      label(ctx, v.role === "lp" ? "LOW-PASS" : "HIGH-PASS", (a.x + b.x) / 2, Math.min(a.y, b.y) - 22, col, "800 14px system-ui");
    }
    // live frequency response of the band filter, across the bottom of this column
    this.e.lp.getFrequencyResponse(this.freqs, this.magLp, this.phase);
    this.e.hp.getFrequencyResponse(this.freqs, this.magHp, this.phase);
    const zw = (zone[1] - zone[0]) * W, x0 = zone[0] * W + 10, w = zw - 20, h = Math.min(130, H * 0.2), y0 = H - h - 14;
    const cx = x => W - x; // canvas is mirrored
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(cx(x0 + w), y0, w, h);
    const yOf = db => y0 + h * (1 - (Math.max(-36, Math.min(18, db)) + 36) / 54);
    ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(cx(x0), yOf(0)); ctx.lineTo(cx(x0 + w), yOf(0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = this.active ? GOLD : "rgba(255,255,255,.7)"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const db = 20 * Math.log10(Math.max(1e-6, this.magLp[i] * this.magHp[i]));
      const x = cx(x0 + (i / (N - 1)) * w), y = yOf(db);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    label(ctx, "bass", cx(x0 + 18), y0 + h - 9, "rgba(255,255,255,.5)", "11px system-ui");
    label(ctx, "treble", cx(x0 + w - 22), y0 + h - 9, "rgba(255,255,255,.5)", "11px system-ui");
  }

  /** Open the filter back up (used when this player leaves). */
  stop() {
    this.lpT = 1; this.hpT = 1; this.q = 0.7;
    const t = this.e.ac.currentTime;
    this.e.lp.frequency.setTargetAtTime(LP_MAX, t, 0.1); this.e.hp.frequency.setTargetAtTime(HP_MIN, t, 0.1);
    this.e.lp.Q.setTargetAtTime(0.7, t, 0.1); this.e.hp.Q.setTargetAtTime(0.7, t, 0.1);
  }
  dispose() { this.stop(); }
}
