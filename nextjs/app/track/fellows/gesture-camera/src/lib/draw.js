// draw.js: draws over the stage: the hands, what each gesture is doing, a
// short guide to the gestures, and the REC light. This layer is only on
// screen; it isn't in the recording.

import { HAND_CONNECTIONS, THUMB_TIP, FINGERS, closeness } from "./hands.js";
import { LOOK_CONTROLS, LOOK_IDS, describe, isNormal } from "./look.js";

const PINCH_COLOR = "#ffb000";
const REC_COLOR = "#e5484d";
const BLUR_COLOR = "#5fb3ff";

// The guide along the bottom of the stage.
const GUIDE = ["👍 record", "👎 stop", "🤏 ↕ brighter / darker", "🤏🤏 bigger · smaller · move", "✌️ blur"];

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function label(ctx, text, x, y, dpr, { align = "center", color = "#ffffff", size = 13 } = {}) {
  ctx.font = `650 ${size * dpr}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4 * dpr;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// A ring that fills as a gesture is held.
function holdRing(ctx, x, y, r, progress, color, dpr) {
  ctx.lineWidth = 4 * dpr;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
}

// The hand, faint, with the thumb and index tips lit up as they get close.
function drawHand(ctx, hand, { at, dpr, reach }) {
  const p = hand.points.map(at);
  ctx.lineCap = "round";
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(p[a][0], p[a][1]);
    ctx.lineTo(p[b][0], p[b][1]);
  }
  ctx.stroke();

  const c = hand.pinched ? 1 : closeness(hand.gaps?.[0] ?? 9, reach);
  const [tx, ty] = p[THUMB_TIP];
  const [ix, iy] = p[FINGERS[0].tip];
  if (c > 0.05) {
    ctx.strokeStyle = withAlpha(PINCH_COLOR, 0.15 + 0.75 * c);
    ctx.lineWidth = (1 + 4 * c) * dpr;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.stroke();
  }
  ctx.fillStyle = withAlpha(PINCH_COLOR, 0.5 + 0.5 * c);
  dot(ctx, tx, ty, (5 + 5 * c) * dpr);
  dot(ctx, ix, iy, (5 + 5 * c) * dpr);
}

// The brightness slider, upright beside the pinching hand.
function drawSlide(ctx, ui, [x, y], dpr) {
  const c = LOOK_CONTROLS[ui.action];
  const h = 150 * dpr;
  const w = 12 * dpr;
  const left = x + 34 * dpr;
  const top = y - h / 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(left - 3 * dpr, top - 3 * dpr, w + 6 * dpr, h + 6 * dpr);
  ctx.fillStyle = withAlpha(c.color, 0.25);
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = c.color;
  ctx.fillRect(left, top + h * (1 - ui.share), w, h * ui.share);
  const normal = (c.normal - c.min) / (c.max - c.min);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(left - 4 * dpr, top + h * (1 - normal) - dpr, w + 8 * dpr, 2 * dpr);
  label(ctx, describe(ui.action, ui.value), left + w + 10 * dpr, y, dpr, { align: "left", color: c.color });
  label(ctx, "▲ brighter", left + w / 2, top - 14 * dpr, dpr, { size: 11 });
  label(ctx, "▼ darker", left + w / 2, top + h + 14 * dpr, dpr, { size: 11 });
}

// Both hands pinching: a band between them, and what it's doing to you.
function drawTwo(ctx, ui, at, dpr) {
  const [ax, ay] = at(ui.a);
  const [bx, by] = at(ui.b);
  ctx.strokeStyle = withAlpha(PINCH_COLOR, 0.85);
  ctx.lineWidth = 3 * dpr;
  ctx.setLineDash([8 * dpr, 6 * dpr]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PINCH_COLOR;
  dot(ctx, ax, ay, 9 * dpr);
  dot(ctx, bx, by, 9 * dpr);
  const mx = (ax + bx) / 2;
  const my = Math.min(ay, by) - 30 * dpr;
  label(ctx, `${describe("size", ui.size)} · ${describe("move", ui.move)}`, mx, my, dpr, { color: PINCH_COLOR, size: 14 });
  label(ctx, "pull apart: bigger · push together: smaller · slide: move", mx, my + 20 * dpr, dpr, { size: 11 });
}

const POSE_TEXT = {
  up: { start: ["Hold to record", "Recording"], none: "Already recording", color: REC_COLOR },
  down: { stop: ["Hold to stop", "Stopped"], none: "Not recording", color: "#ffffff" },
  peace: { blur: ["Hold for blur", null], none: "", color: BLUR_COLOR },
};

function drawPose(ctx, ui, [x, y], dpr, look) {
  const t = POSE_TEXT[ui.pose];
  const r = 26 * dpr;
  let text = t.none;
  if (ui.action) {
    const [holding, done] = t[ui.action];
    text = ui.fired ? done ?? (look.blur > 0.005 ? "Blur on" : "Blur off") : holding;
  }
  if (ui.action) holdRing(ctx, x, y, r, ui.progress, t.color, dpr);
  label(ctx, text, x, y - r - 14 * dpr, dpr, { color: ui.action ? "#ffffff" : "rgba(255, 255, 255, 0.7)" });
}

function drawGuide(ctx, width, height, dpr) {
  const widthAt = (size, gap) => {
    ctx.font = `600 ${size * dpr}px system-ui, sans-serif`;
    return GUIDE.reduce((sum, item) => sum + ctx.measureText(item).width, 0) + gap * dpr * (GUIDE.length - 1);
  };
  // Shrink everything to fit a narrow stage.
  const fit = Math.min(1, (width - 32 * dpr) / widthAt(14, 22));
  const size = 14 * fit;
  const gap = 22 * fit;
  const total = widthAt(size, gap);
  const barH = (size + 16) * dpr;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, height - barH, width, barH);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  let x = (width - total) / 2;
  for (const item of GUIDE) {
    ctx.fillText(item, x, height - barH / 2);
    x += ctx.measureText(item).width + gap * dpr;
  }
}

// hands: from readHands(), with `gaps` and `pinched`. ui: from updateGestures.
// place: moves a point of the camera picture to where it's shown once you're
// resized and moved (see PersonLayer.place), or null when you aren't.
// rec: { on, startedAt } · flash: { t, color } or null · look: the current look.
// guide: whether to show the gesture guide along the bottom.
export function drawStage(ctx, { width, height, dpr, hands, ui, mirror, reach, now, rec, flash, look, place = null, guide = true }) {
  ctx.clearRect(0, 0, width, height);
  const at = (q) => {
    const r = place ? place(q) : q;
    return [(mirror ? 1 - r.x : r.x) * width, r.y * height];
  };

  for (const hand of hands) drawHand(ctx, hand, { at, dpr, reach });
  for (const item of ui) {
    if (item.kind === "slide") drawSlide(ctx, item, at(item.at), dpr);
    else if (item.kind === "two") drawTwo(ctx, item, at, dpr);
    else if (item.kind === "pose") drawPose(ctx, item, at(item.at), dpr, look);
  }

  // A quick colored edge when recording starts or stops, so a performer
  // facing the screen sees that it worked.
  if (flash) {
    const age = (now - flash.t) / 600;
    if (age < 1) {
      ctx.lineWidth = 14 * dpr;
      ctx.strokeStyle = withAlpha(flash.color, 1 - age);
      ctx.strokeRect(0, 0, width, height);
    }
  }

  if (rec.on) {
    const blink = Math.floor((now - rec.startedAt) / 500) % 2 === 0;
    ctx.fillStyle = blink ? REC_COLOR : "rgba(229, 72, 77, 0.35)";
    dot(ctx, 26 * dpr, 26 * dpr, 8 * dpr);
    label(ctx, `REC ${clock(now - rec.startedAt)}`, 42 * dpr, 27 * dpr, dpr, { align: "left", size: 15 });
  }

  // Any control that isn't normal, top right.
  const changed = LOOK_IDS.filter((id) => !isNormal(look, id));
  changed.forEach((id, i) => {
    label(ctx, describe(id, look[id]), width - 16 * dpr, (26 + i * 20) * dpr, dpr, { align: "right", color: LOOK_CONTROLS[id].color, size: 12 });
  });

  if (guide) drawGuide(ctx, width, height, dpr);
}
