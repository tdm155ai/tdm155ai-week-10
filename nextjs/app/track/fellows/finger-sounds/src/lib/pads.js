// pads.js: what each finger plays, and its key on the keyboard.
//
// `finger` is 0 index, 1 middle, 2 ring, 3 pinky (see FINGERS in hands.js).
// `sound` is a name from SOUNDS in sounds.js. You can also change the sound in
// the page, or drop your own audio file on a pad.

export const DEFAULT_PADS = [
  { id: "left-pinky", hand: "left", finger: 3, sound: "cowbell", key: "a" },
  { id: "left-ring", hand: "left", finger: 2, sound: "tambourine", key: "s" },
  { id: "left-middle", hand: "left", finger: 1, sound: "timbale-low", key: "d" },
  { id: "left-index", hand: "left", finger: 0, sound: "timbale-high", key: "f" },
  { id: "right-index", hand: "right", finger: 0, sound: "clap", key: "j" },
  { id: "right-middle", hand: "right", finger: 1, sound: "snare", key: "k" },
  { id: "right-ring", hand: "right", finger: 2, sound: "hat", key: "l" },
  { id: "right-pinky", hand: "right", finger: 3, sound: "kick", key: ";" },
];
