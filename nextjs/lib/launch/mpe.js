// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /launch/mpe: play a ROLI Seaboard BLOCK (or any MIDI keyboard) and watch every touch.
//  Save it and the page updates. Started from the purple fellow's MIDI studies (LL week 10 experiments).
// ─────────────────────────────────────────────────────────────────────────────
//
// MPE ("MIDI Polyphonic Expression") gives every finger its own MIDI channel (2 to 16; channel 1 is the "master"),
// so each note can bend, slide and press on its own. The Seaboard sends five dimensions per note:
//   strike  = velocity of the note-on          glide = pitch bend (sliding left and right, or wiggling: vibrato)
//   press   = channel pressure (aftertouch)    slide = CC74 (moving your finger up and down the key)
//   lift    = release velocity (not used here)

// How many semitones a full pitch bend is. ROLI's MPE default is 48 (the page has a box to change it).
export const BEND_RANGE = 48;
// Ordinary keyboards (everything on channel 1) usually bend 2 semitones.
export const KEYBOARD_BEND_RANGE = 2;

// Which controllers count as "slide". 74 is MPE's; 1 is the mod wheel on an ordinary keyboard.
export const SLIDE_CCS = [74, 1];

// The sounds. Each note gets its own voice: oscillators → a low-pass filter → loudness.
//   wave: "sine" | "triangle" | "sawtooth" | "square";  wave2 + detune (cents): a second oscillator, for width
//   sub:  how loud a sine an octave below is (0 = none)
//   cutoff: the filter's frequency (Hz) with slide at the bottom; slideOctaves: how much slide opens it
//   attack, release: seconds to fade in and out;  decay + sustain: a pluck dies down to `sustain` while held
export const patches = {
  pad: { label: "Pad", wave: "sawtooth", wave2: "sawtooth", detune: 9, sub: 0.2, cutoff: 300, slideOctaves: 5, q: 2, attack: 0.08, decay: 0, sustain: 1, release: 0.9, reverb: 0.35 },
  pluck: { label: "Pluck", wave: "triangle", wave2: "square", detune: 4, sub: 0, cutoff: 600, slideOctaves: 4, q: 4, attack: 0.004, decay: 0.6, sustain: 0.25, release: 0.4, reverb: 0.25 },
  bass: { label: "Bass", wave: "square", wave2: "sawtooth", detune: 6, sub: 0.6, cutoff: 150, slideOctaves: 4.5, q: 6, attack: 0.01, decay: 0, sustain: 1, release: 0.18, reverb: 0.05 },
};

// The picture. X = pitch (with bend), Y = slide, size and glow = pressure, and a trail so glides and wiggles show.
export const look = {
  trailSeconds: 1.6, // how long a trail lasts
  glow: 1, // bigger = brighter blobs
  background: "#04050a",
  // One color per MPE channel (by hue, 0–360), so you can tell fingers apart.
  hue: (channel) => (channel * 47 + 300) % 360,
};
