// Body zones for /track/zones: the room is split into columns; a person stepping into a column fires its cue once.
// zoneOf and stickyZone are copied from Marlon's /live-score "Zones (launch)" mode (bok-to-the-future/the-apps/
// mk-audio-editing, interface/nextjs/app/live-score/mapping.mjs, Oct 22): a person standing on a line stays in the
// zone they were in until they are clearly past it, so the sound doesn't stutter.

export function zoneOf(x, zones) {
  return Math.min(zones - 1, Math.max(0, Math.floor(x * zones)));
}

// Stay in the current zone until x is clearly past its edge (margin is a share of the frame's width).
export function stickyZone(x, current, zones, margin = 0.04) {
  if (current == null || current < 0) return zoneOf(x, zones);
  return x >= current / zones - margin && x <= (current + 1) / zones + margin ? current : zoneOf(x, zones);
}

// Where a body is: the middle of its shoulders and hips (whichever the model can see), in 0–1 frame coordinates.
export function bodyCentre(points) {
  const seen = [11, 12, 23, 24].map((n) => points[n]).filter((p) => p && (p.visibility ?? 1) > 0.4);
  const body = seen.length ? seen : [points[0]];
  return { x: body.reduce((s, p) => s + p.x, 0) / body.length, y: body.reduce((s, p) => s + p.y, 0) / body.length };
}

// Follow people from frame to frame (nearest x), so each keeps their zone. `step(xs, now)` takes each person's x and
// returns { people: [{ id, x, zone }], occupied: [count per zone], entered: [zone numbers entered this frame] }.
// `refire`: a zone won't fire again within this many seconds. `grace`: someone the model loses for a moment keeps their
// zone, so they don't re-fire it when they're found again.
export function createZoneTracker({ zones = 3, margin = 0.04, refire = 0.5, grace = 0.6 } = {}) {
  let tracks = [];
  let nextId = 1;
  const lastFire = new Array(zones).fill(-Infinity);
  return function step(xs, now = performance.now() / 1000) {
    const entered = [];
    const free = new Set(tracks.keys());
    const people = xs.map((x) => {
      let best = -1;
      let bestGap = 0.2;
      for (const i of free) { const gap = Math.abs(tracks[i].x - x); if (gap < bestGap) { bestGap = gap; best = i; } }
      if (best >= 0) free.delete(best);
      const before = best >= 0 ? tracks[best] : null;
      const zone = stickyZone(x, before?.zone, zones, margin);
      if ((!before || before.zone !== zone) && now - lastFire[zone] >= refire) { lastFire[zone] = now; entered.push(zone); }
      return { id: before?.id ?? nextId++, x, zone, seenAt: now };
    });
    const kept = [...free].map((i) => tracks[i]).filter((t) => now - t.seenAt < grace);
    tracks = [...people, ...kept];
    const occupied = new Array(zones).fill(0);
    tracks.forEach((t) => { occupied[t.zone] += 1; });
    return { people, occupied, entered };
  };
}
