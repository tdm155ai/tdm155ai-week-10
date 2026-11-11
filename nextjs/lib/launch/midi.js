// Web MIDI in Chrome: pads, keys, and dials from any USB MIDI controller (Akai MPK, a drum pad, a keyboard), straight
// into the page. No driver, no install. Browser-only.
//
//   const stop = await connectMidi({ onMessage: (m) => ..., onDevices: (list) => ... });
//
// Each message comes out as { type, channel, number, value, device }:
//   noteon / noteoff  number = the note (pads are notes too: an MPK mini's pads are 36–43), value = velocity 0–127
//   cc                number = the controller (a dial or slider; an MPK mini's knobs are 70–77), value = 0–127
//   pitchbend         value = 0–16383 (8192 is the middle)
//   aftertouch, program, and anything else: as named, with the raw bytes in `data`

const TYPES = { 0x80: "noteoff", 0x90: "noteon", 0xa0: "polytouch", 0xb0: "cc", 0xc0: "program", 0xd0: "aftertouch", 0xe0: "pitchbend" };

export function midiSupported() {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

export function parseMidi(data, device = "") {
  const [status, a = 0, b = 0] = data;
  if (status >= 0xf0) return { type: status === 0xf8 ? "clock" : "system", channel: 0, number: a, value: b, device, data: [...data] };
  let type = TYPES[status & 0xf0] || "unknown";
  const channel = (status & 0x0f) + 1;
  if (type === "noteon" && b === 0) type = "noteoff"; // many devices send note-on with velocity 0 for a release
  if (type === "pitchbend") return { type, channel, number: 0, value: (b << 7) | a, device, data: [...data] };
  if (type === "program" || type === "aftertouch") return { type, channel, number: a, value: a, device, data: [...data] };
  return { type, channel, number: a, value: b, device, data: [...data] };
}

// Ask Chrome for MIDI (it asks the user the first time) and listen to every input, including ones plugged in later.
export async function connectMidi({ onMessage, onDevices } = {}) {
  if (!midiSupported()) throw new Error("No Web MIDI in this browser: use Chrome or Edge.");
  const access = await navigator.requestMIDIAccess({ sysex: false });
  const attach = () => {
    const list = [];
    for (const input of access.inputs.values()) {
      list.push({ id: input.id, name: input.name, manufacturer: input.manufacturer, state: input.state });
      input.onmidimessage = (e) => {
        const m = parseMidi(e.data, input.name);
        if (m.type === "clock" || m.type === "system") return; // timing ticks would flood the monitor
        onMessage?.(m);
      };
    }
    onDevices?.(list);
  };
  attach();
  access.onstatechange = attach;
  return () => {
    access.onstatechange = null;
    for (const input of access.inputs.values()) input.onmidimessage = null;
  };
}

// Note number to a name: 60 → "C4".
export function noteName(n) {
  return `${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][n % 12]}${Math.floor(n / 12) - 1}`;
}
