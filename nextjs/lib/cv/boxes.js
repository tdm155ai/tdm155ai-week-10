// Several boxes at once for /draw-a-box: follow each box from frame to frame (nearest middle), so each keeps its own
// steadying, its own card color, and its own place on screen. A box that's lost is held briefly, then let go.

import { centre, makeStabilizer } from "./opencv.js";

export function makeBoxTracker({ max = 4, follow = 0.15 } = {}) {
  let tracks = [];
  let nextId = 1;
  // `quads`: this frame's boxes (or null when nothing was looked at this frame); `scale`: the frame's width.
  return function step(quads, scale, now = performance.now()) {
    if (quads) {
      const free = new Set(tracks.keys());
      for (const quad of quads) {
        const middle = centre(quad);
        let best = -1;
        let bestGap = follow * scale;
        for (const i of free) {
          const gap = Math.hypot(tracks[i].middle.x - middle.x, tracks[i].middle.y - middle.y);
          if (gap < bestGap) { bestGap = gap; best = i; }
        }
        if (best >= 0) {
          free.delete(best);
          const t = tracks[best];
          t.quad = t.stabilize(quad, scale, now);
          t.middle = middle;
          t.raw = quad;
        } else if (tracks.length < max) {
          const used = new Set(tracks.map((t) => t.slot));
          let slot = 0;
          while (used.has(slot)) slot += 1;
          const t = { id: nextId++, slot, stabilize: makeStabilizer(), middle, raw: quad, vote: { card: null, count: 0, shown: null } };
          t.quad = t.stabilize(quad, scale, now);
          tracks.push(t);
        }
      }
      for (const i of free) tracks[i].quad = tracks[i].stabilize(null, scale, now);
      tracks = tracks.filter((t) => t.quad);
    }
    return tracks;
  };
}
