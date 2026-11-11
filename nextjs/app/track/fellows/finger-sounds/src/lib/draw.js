// draw.js: draws the hands and the hit bursts over the camera picture.

import { FINGERS, HAND_CONNECTIONS, THUMB_TIP, closeness } from "./hands.js";

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// The loop's beat on the stage, for performers looking at the projection: a
// big count of four before recording, then a light for each beat, and REC.
function drawLoop(ctx, { width, height, dpr }, { pos, beats, recording }) {
  if (pos === null) return;
  ctx.textBaseline = "middle";
  if (pos < 0) {
    const count = Math.floor(pos) + 5;
    const fade = 1 - (pos - Math.floor(pos)) * 0.7;
    ctx.font = `700 ${Math.round(height * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255, 176, 0, ${fade})`;
    ctx.fillText(String(count), width / 2, height / 2);
  } else {
    const beat = Math.floor(pos);
    const r = 7 * dpr;
    const gap = 22 * dpr;
    for (let i = 0; i < beats; i++) {
      const x = 22 * dpr + i * gap + Math.floor(i / 4) * 8 * dpr;
      const y = 22 * dpr;
      ctx.beginPath();
      ctx.arc(x, y, i === beat ? r * 1.25 : r, 0, Math.PI * 2);
      if (i === beat) {
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      } else {
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
        ctx.stroke();
      }
    }
  }
  if (recording) {
    ctx.fillStyle = "#e5484d";
    ctx.beginPath();
    ctx.arc(width - 64 * dpr, 22 * dpr, 7 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 ${14 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("REC", width - 52 * dpr, 23 * dpr);
  }
  ctx.textBaseline = "alphabetic";
}

// hands: from readHands(), each with `gaps` and `active` added.
// bursts: [{ x, y, color, t }] in the camera's own 0–1 coordinates; old ones
// are removed here.
// hud: the loop's place ({ pos, beats, recording }), or null when it's stopped.
export function drawScene(ctx, { width, height, dpr, hands, bursts, mirror, reach, now, hud = null }) {
  ctx.clearRect(0, 0, width, height);
  const X = (x) => (mirror ? 1 - x : x) * width;
  const Y = (y) => y * height;

  for (const hand of hands) {
    const p = hand.points;

    ctx.lineCap = "round";
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(X(p[a].x), Y(p[a].y));
      ctx.lineTo(X(p[b].x), Y(p[b].y));
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    for (const q of p) dot(ctx, X(q.x), Y(q.y), 2.5 * dpr);

    const thumb = p[THUMB_TIP];
    FINGERS.forEach((finger, i) => {
      const tip = p[finger.tip];
      const c = hand.active === i ? 1 : closeness(hand.gaps?.[i] ?? 9, reach);
      if (c > 0.05) {
        ctx.strokeStyle = withAlpha(finger.color, 0.15 + 0.75 * c);
        ctx.lineWidth = (1 + 4 * c) * dpr;
        ctx.beginPath();
        ctx.moveTo(X(thumb.x), Y(thumb.y));
        ctx.lineTo(X(tip.x), Y(tip.y));
        ctx.stroke();
      }
      ctx.fillStyle = withAlpha(finger.color, 0.55 + 0.45 * c);
      dot(ctx, X(tip.x), Y(tip.y), (6 + 7 * c) * dpr);
    });

    ctx.fillStyle = "#ffffff";
    dot(ctx, X(thumb.x), Y(thumb.y), 8 * dpr);

    ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(hand.hand === "left" ? "LEFT" : "RIGHT", X(p[0].x), Y(p[0].y) + 22 * dpr);
  }

  for (let i = bursts.length - 1; i >= 0; i--) {
    const burst = bursts[i];
    // A burst can be stamped a moment after this frame's `now`; never draw it with a negative age.
    const age = Math.max(0, (now - burst.t) / 500);
    if (age >= 1) {
      bursts.splice(i, 1);
      continue;
    }
    const grow = 1 - Math.pow(1 - age, 3);
    const r = (14 + 90 * grow) * dpr;
    if (age < 0.25) {
      ctx.fillStyle = withAlpha(burst.color, 0.5 * (1 - age * 4));
      dot(ctx, X(burst.x), Y(burst.y), r * 0.6);
    }
    ctx.strokeStyle = withAlpha(burst.color, 1 - age);
    ctx.lineWidth = (1 + 6 * (1 - age)) * dpr;
    ctx.beginPath();
    ctx.arc(X(burst.x), Y(burst.y), r, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (hud) drawLoop(ctx, { width, height, dpr }, hud);
}
