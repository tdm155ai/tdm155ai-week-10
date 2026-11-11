"use client";

// The paint helpers for the masks in ./masks.js. A mask is painted once on a flat face (the same flat face, or
// "unwrap", as /track/face-paint), 1024 × 1024, and the page stretches it over your face. Forehead at the top,
// chin at the bottom; the face's own right is on the left. p.at(i) says where MediaPipe's face point i is.

import { FACE_MESH_UVS } from "../../../lib/cv/face-mesh-data.js";

export const PAD = 1024;

// Contours on MediaPipe's face map (the numbers are face points).
export const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
export const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const LEFT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
export const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const CRACK_STARTS = [10, 109, 338, 67, 297, 54, 284, 21, 251, 50, 280, 205, 425, 152, 148, 377, 172, 397, 127, 356];
const VEIN_STARTS = [127, 356, 162, 389, 234, 454, 33, 263, 21, 251];

// The same "random" every time, so a mask looks the same each time it's painted.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(color, alpha) {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Paint one mask from ./masks.js onto `canvas` (PAD × PAD).
export function paintMask(canvas, mask) {
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.clearRect(0, 0, PAD, PAD);
  mask?.paint?.(painter(ctx));
  ctx.restore();
}

function painter(ctx) {
  const random = seeded(155);
  const at = (i) => [FACE_MESH_UVS[i * 2] * PAD, (1 - FACE_MESH_UVS[i * 2 + 1]) * PAD];
  const centerOf = (ids) => {
    const pts = ids.map(at);
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  };
  const trace = (ids, grow = 1) => {
    const [cx, cy] = centerOf(ids);
    ctx.beginPath();
    ids.forEach((id, k) => {
      const [x, y] = at(id);
      const gx = cx + (x - cx) * grow, gy = cy + (y - cy) * grow;
      if (k) ctx.lineTo(gx, gy); else ctx.moveTo(gx, gy);
    });
    ctx.closePath();
  };
  const soft = (blur, draw) => {
    ctx.save();
    ctx.filter = blur ? `blur(${blur}px)` : "none";
    draw();
    ctx.restore();
  };
  const insideFace = (draw) => {
    ctx.save();
    trace(FACE_OVAL);
    ctx.clip();
    draw();
    ctx.restore();
  };
  // A jagged (or, with bend < 0.3, wavy) line that sometimes splits in two.
  const branch = (x, y, angle, length, width, bend, depth) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 5 + Math.floor(random() * 5);
    for (let s = 0; s < steps; s++) {
      angle += (random() - 0.5) * bend * 2;
      x += Math.cos(angle) * (length / steps);
      y += Math.sin(angle) * (length / steps);
      ctx.lineTo(x, y);
      if (depth > 0 && random() < 0.22) {
        ctx.stroke();
        branch(x, y, angle + (random() < 0.5 ? -1 : 1) * (0.5 + random() * 0.6), length * 0.5, width * 0.65, bend, depth - 1);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  };

  return {
    ctx,
    at,
    size: PAD,
    random,

    skin(color, opacity = 1) {
      soft(14, () => { ctx.globalAlpha = opacity; ctx.fillStyle = color; trace(FACE_OVAL, 0.97); ctx.fill(); });
    },

    sockets(color, size = 2, opacity = 0.9) {
      for (const ids of [RIGHT_EYE, LEFT_EYE]) {
        const [cx, cy] = centerOf(ids);
        const r = (Math.hypot(at(ids[0])[0] - at(ids[8])[0], at(ids[0])[1] - at(ids[8])[1]) / 2) * size;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, 0.8);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, rgba(color, opacity));
        g.addColorStop(0.5, rgba(color, opacity * 0.85));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },

    lips(color, opacity = 1) {
      soft(3, () => { ctx.globalAlpha = opacity; ctx.fillStyle = color; trace(LIPS_OUTER); ctx.fill(); });
    },

    tears(color, length = 1) {
      soft(1.5, () => {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineCap = "round";
        for (const id of [145, 153, 144, 374, 380, 373]) {
          let [x, y] = at(id);
          const total = PAD * 0.22 * length * (0.55 + random() * 0.6);
          const steps = 24;
          const start = 9 + random() * 7;
          for (let s = 0; s < steps; s++) {
            const nx = x + (random() - 0.5) * 5;
            const ny = y + total / steps;
            ctx.lineWidth = start * Math.pow(1 - s / steps, 0.6) + 1.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            x = nx;
            y = ny;
          }
          ctx.beginPath();
          ctx.arc(x, y, 4 + random() * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    },

    cracks(color, count = 10) {
      insideFace(() => {
        ctx.strokeStyle = color;
        ctx.lineJoin = "miter";
        for (let i = 0; i < count; i++) {
          const [x, y] = at(CRACK_STARTS[i % CRACK_STARTS.length]);
          branch(x, y, random() * Math.PI * 2, 90 + random() * 120, 2.5 + random() * 1.5, 0.7, 2);
        }
      });
    },

    veins(color, count = 8, opacity = 0.7) {
      insideFace(() => {
        ctx.strokeStyle = rgba(color, opacity);
        ctx.lineCap = "round";
        for (let i = 0; i < count; i++) {
          const id = VEIN_STARTS[i % VEIN_STARTS.length];
          const [x, y] = at(id);
          const toward = Math.atan2(PAD * 0.5 - y, PAD * 0.5 - x); // in from the edge of the face
          branch(x, y, toward + (random() - 0.5), 110 + random() * 120, 2.2, 0.25, 3);
        }
      });
    },

    blotches(color, count = 30, opacity = 0.25) {
      insideFace(() => {
        for (let i = 0; i < count; i++) {
          const x = PAD * (0.12 + random() * 0.76), y = PAD * (0.08 + random() * 0.86), r = 20 + random() * 70;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, rgba(color, opacity));
          g.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      });
    },

    stitches(color, from, to, count = 6) {
      const [x1, y1] = at(from), [x2, y2] = at(to);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const nx = -Math.sin(angle) * 14, ny = Math.cos(angle) * 14;
      soft(1, () => {
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.lineWidth = 4;
        for (let k = 0; k <= count; k++) {
          const t = k / count, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
          ctx.beginPath();
          ctx.moveTo(x - nx, y - ny);
          ctx.lineTo(x + nx, y + ny);
          ctx.stroke();
        }
      });
    },

    teeth(color, gapColor = "#111111", count = 10) {
      const [lx] = at(61), [rx] = at(291);
      ctx.save();
      trace(LIPS_OUTER, 1.6);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, PAD, PAD);
      ctx.strokeStyle = gapColor;
      ctx.lineWidth = 5;
      for (let k = 1; k < count; k++) {
        const x = lx + ((rx - lx) * k) / count;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, PAD);
        ctx.stroke();
      }
      ctx.lineWidth = 7;
      ctx.beginPath();
      LIPS_INNER.slice(0, 11).forEach((id, k) => { const [x, y] = at(id); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.restore();
    },

    noseHole(color) {
      soft(4, () => {
        const [ax, ay] = at(195), [rx, ry] = at(98), [lx, ly] = at(327), [bx, by] = at(2);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(lx + 22, ly - 20, lx + 6, ly + 4);
        ctx.lineTo(bx, by + 10);
        ctx.lineTo(rx - 6, ry + 4);
        ctx.quadraticCurveTo(rx - 22, ry - 20, ax, ay);
        ctx.fill();
      });
    },

    cheekHollows(color, opacity = 0.6) {
      for (const id of [147, 376]) {
        const [x, y] = at(id);
        const cx = x + (PAD / 2 - x) * 0.25, cy = y + 40;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(0.7, 1.3);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 110);
        g.addColorStop(0, rgba(color, opacity));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-110, -110, 220, 220);
        ctx.restore();
      }
    },
  };
}
