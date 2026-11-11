export const GESTURES = ["Closed_Fist", "Open_Palm", "Pointing_Up", "Thumb_Down", "Thumb_Up", "Victory", "ILoveYou"];
export const ACTIONS = ["clip", "hit", "chord", "pattern", "note", "cc"];
export const label = (value) => value.replaceAll("_", " ");
export const defaults = () => [
  { id: "clip", enabled: false, gesture: "Closed_Fist", hand: "Either", action: "clip", clip: "", loop: false },
  { id: "hit", enabled: true, gesture: "Thumb_Up", hand: "Either", action: "hit" },
  { id: "chord", enabled: true, gesture: "Victory", hand: "Either", action: "chord" },
  { id: "pattern", enabled: true, gesture: "Open_Palm", hand: "Either", action: "pattern" },
  { id: "midi", enabled: false, gesture: "Pointing_Up", hand: "Either", action: "note", channel: 1, number: 60, value: 96, duration: 300 },
];

export function validMappings(rows) {
  if (!Array.isArray(rows) || rows.length > 32) return false;
  return rows.every((r) => r && typeof r.id === "string" && typeof r.enabled === "boolean" && GESTURES.includes(r.gesture) && ["Either", "Left", "Right"].includes(r.hand) && ACTIONS.includes(r.action)) && new Set(rows.map((r) => r.id)).size === rows.length;
}

// One gate per mapping, not per detection index (MediaPipe can reorder hands).
// A fired gate remains latched through short gaps; only a sustained release rearms it.
export function stepGate(previous, matches, now, holdMs, releaseMs) {
  const gate = previous ? { ...previous } : { since: null, absent: null, fired: false };
  if (!matches) {
    gate.since = null;
    gate.absent ??= now;
    if (now - gate.absent >= releaseMs) gate.fired = false;
    return { gate, fire: false };
  }
  gate.absent = null;
  gate.since ??= now;
  const fire = !gate.fired && now - gate.since >= holdMs;
  if (fire) gate.fired = true;
  return { gate, fire };
}

export function midiMessages(row, now = 0) {
  const integer = (value, low, high, fallback) => Math.min(high, Math.max(low, Math.round(Number.isFinite(Number(value)) ? Number(value) : fallback)));
  const channel = integer(row.channel, 1, 16, 1) - 1;
  const number = integer(row.number, 0, 127, 60);
  const value = integer(row.value, 0, 127, 96);
  return row.action === "cc"
    ? [{ bytes: [0xb0 + channel, number, value], at: now }]
    : [{ bytes: [0x90 + channel, number, value], at: now }, { bytes: [0x80 + channel, number, 0], at: now + integer(row.duration, 20, 10000, 300) }];
}
