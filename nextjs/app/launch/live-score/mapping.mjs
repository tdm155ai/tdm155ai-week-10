// From what the camera sees to what the score does. Pure functions, so they can be checked without a camera or audio.
//
// Two modes, after the two game-audio techniques:
// - zones (vertical layering by place): the frame is cut into columns, one loop per column; people in a column bring
//   its loop up, and movement in it brightens it.
// - spot (a proximity parameter, like distance-to-object in FMOD or Wwise): one person, the nearest to a marked spot,
//   is the listener the whole room follows; the closer they get, the more loops enter, one after another.
// In both, the room's total motion is "intensity": it opens the filters and brings in the shimmer.

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Where a person is in the room: x -1 left … 1 right (the mirrored preview, as people facing the front see it);
// y -1 rear … 1 front. A front camera reads depth from body size; an overhead camera from height in the frame.
export function roomPosition(person, depthFrom) {
  const y = depthFrom === 'height' ? 1 - 2 * person.y : clamp((person.size - 0.06) / 0.3) * 2 - 1;
  return { x: clamp(person.x * 2 - 1, -1, 1), y: clamp(y, -1, 1) };
}

export function scoreFromRoom({ people = [], motion = { zones: [], total: 0, x: 0.5, y: 0.5 }, mode = 'zones', spot = { x: 0.5, y: 0.6 }, depthFrom = 'size', zones = 5 }) {
  const intensity = clamp(motion.total * 8);
  const brightness = intensity;
  const shimmer = 0.55 * intensity ** 1.3;
  const shimmerPan = { x: motion.x * 2 - 1, y: depthFrom === 'height' ? 1 - 2 * motion.y : 0 };
  const drone = 0.08 + 0.1 * Math.min(1, people.length) + 0.06 * intensity;
  const positions = people.map(p => roomPosition(p, depthFrom));

  if (mode === 'spot') {
    let listener = -1, best = Infinity;
    people.forEach((p, i) => { const d = Math.hypot(p.x - spot.x, p.y - spot.y); if (d < best) { best = d; listener = i; } });
    const proximity = listener < 0 ? 0 : clamp(1 - best / 0.5);
    const levels = Array.from({ length: zones }, (_, i) => 0.05 + 0.9 * clamp((proximity - i * 0.18) / 0.15));
    const at = listener < 0 ? { x: 0, y: 0 } : positions[listener];
    const pans = levels.map((_, i) => ({ x: clamp(at.x + (i - (zones - 1) / 2) * 0.25, -1, 1), y: at.y }));
    return { levels, pans, shimmer, shimmerPan, drone, brightness, intensity, presence: levels.map(() => 0), listener, proximity };
  }

  const sigma = 0.6 / zones;
  const presence = Array.from({ length: zones }, (_, z) => {
    const c = (z + 0.5) / zones;
    return clamp(people.reduce((s, p) => s + Math.exp(-(((p.x - c) / sigma) ** 2) / 2), 0));
  });
  // Resting level 0.18 (was 0.06), so in a still room the loops, not the drone, are what you hear.
  const levels = presence.map((pr, z) => clamp(0.18 + 0.52 * pr + 0.3 * clamp((motion.zones[z] ?? 0) * 6)));
  const pans = presence.map((pr, z) => {
    const c = (z + 0.5) / zones;
    const w = people.map(p => Math.exp(-(((p.x - c) / sigma) ** 2) / 2));
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum < 0.05) return { x: c * 2 - 1, y: 0 };
    return { x: positions.reduce((s, q, i) => s + q.x * w[i], 0) / sum, y: positions.reduce((s, q, i) => s + q.y * w[i], 0) / sum };
  });
  return { levels, pans, shimmer, shimmerPan, drone, brightness, intensity, presence, listener: -1, proximity: 0 };
}

// ---- Zones (launch) mode -------------------------------------------------------------------------------------------
// Being in a zone means something: crossing into one fires that zone's stinger at once and brings its loop up fast;
// leaving lets it fall over about 3 s. Hysteresis keeps someone standing on a line from flickering between two zones.
// Hands: raising one above its shoulder fires the stinger of the zone the hand is in (re-armed when it drops);
// reaching a hand into the next zone sounds that zone too; both hands up swells the whole piece.

export function zoneOf(x, zones) {
  return Math.min(zones - 1, Math.max(0, Math.floor(x * zones)));
}

// Stay in the current zone until x is clearly past its edge (margin is a share of the frame's width).
export function stickyZone(x, current, zones, margin = 0.04) {
  if (current == null || current < 0) return zoneOf(x, zones);
  return x >= current / zones - margin && x <= (current + 1) / zones + margin ? current : zoneOf(x, zones);
}

const RAISE = 0.03, DROP = 0.02, REACH = 0.07;

export function createLaunchTracker({ zones = 5, margin = 0.04, refire = 0.35, grace = 0.5 } = {}) {
  let tracks = [], nextId = 1;
  const lastFire = new Array(zones).fill(-Infinity);
  return function step(people, now) {
    const events = [];
    const fire = (zone, why, id, guard = refire) => {
      if (now - lastFire[zone] < guard) return;
      lastFire[zone] = now;
      events.push({ zone, why, id });
    };
    // Match people to last frame's tracks by nearest x, so each keeps its zone and hand state.
    const free = new Set(tracks.keys());
    const seen = people.map(p => {
      let best = -1, bestD = 0.2;
      for (const i of free) { const d = Math.abs(tracks[i].x - p.x); if (d < bestD) { bestD = d; best = i; } }
      if (best >= 0) free.delete(best);
      const prev = best >= 0 ? tracks[best] : null;
      const id = prev?.id ?? nextId++;
      const zone = stickyZone(p.x, prev?.zone, zones, margin);
      if (!prev || prev.zone !== zone) fire(zone, 'enter', id);
      const hands = (p.hands ?? []).map((h, k) => {
        const was = prev?.hands?.[k];
        if (!h.visible) return { ...h, raised: false, zone: -1, reach: -1 };
        const raised = was?.raised ? h.y < h.shoulderY + DROP : h.y < h.shoulderY - RAISE;
        const handZone = stickyZone(h.x, was?.zone, zones, margin);
        if (raised && !was?.raised) fire(handZone, 'hand', id, 0.15);
        const reach = handZone !== zone && Math.abs(h.x - p.x) > REACH ? handZone : -1;
        if (reach >= 0 && reach !== was?.reach) fire(reach, 'reach', id);
        return { ...h, raised, zone: handZone, reach };
      });
      return { id, x: p.x, y: p.y, zone, hands, lastSeen: now };
    });
    // A person the model misses for a moment keeps their zone (no refire when they reappear).
    const kept = [...free].map(i => tracks[i]).filter(t => now - t.lastSeen < grace);
    tracks = [...seen, ...kept];
    const occupied = new Array(zones).fill(0);
    tracks.forEach(t => {
      occupied[t.zone] = 1;
      t.hands.forEach(h => { if (h.reach >= 0) occupied[h.reach] = Math.max(occupied[h.reach], 0.7); });
    });
    const swell = seen.some(t => t.hands.length === 2 && t.hands.every(h => h.raised)) ? 1 : 0;
    return { tracks: seen, occupied, events, swell };
  };
}

export function launchScore({ room, people = [], motion = { total: 0, x: 0.5, y: 0.5 }, depthFrom = 'size', zones = 5 }) {
  const intensity = clamp(motion.total * 8);
  const levels = room.occupied.map(o => 0.9 * o);
  const pans = levels.map((_, z) => ({ x: ((z + 0.5) / zones) * 2 - 1, y: 0 }));
  return {
    levels, pans, fast: true, swell: room.swell,
    shimmer: clamp(0.55 * intensity ** 1.3 + 0.4 * room.swell),
    shimmerPan: { x: motion.x * 2 - 1, y: depthFrom === 'height' ? 1 - 2 * motion.y : 0 },
    drone: 0.08 + 0.1 * Math.min(1, people.length),
    brightness: clamp(intensity + 0.6 * room.swell),
    intensity, presence: room.occupied, listener: -1, proximity: 0,
  };
}
