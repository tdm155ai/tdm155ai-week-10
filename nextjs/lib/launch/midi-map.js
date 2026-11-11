// THE FILE TO CHANGE: which pad or key fires which cue, and which dial moves what, on /launch/midi.
// Easiest: on the page, press "Learn" next to a cue, hit a pad, then "Copy as code" and paste it over `notes` below.
//
// notes: MIDI note number → the id of a button in lib/launch/buttons.js (or a whole cue object).
//   Akai MPK mini pads send 36–43 (bank A); a 4×4 drum pad usually sends 36–51; piano middle C is 60.
// dials: MIDI controller (CC) number → a stage control: master (volume), opacity, brightness, hue.
//   Akai MPK mini knobs send CC 70–77.
// velocity: true makes a harder hit play a sound louder.

export const notes = {
  36: "title",
  37: "ping",
  38: "dawn",
  39: "chord",
  40: "fractal",
  41: "red",
  42: "wind",
  43: "moon",
  44: "out",
};

export const dials = {
  70: "master",
  71: "opacity",
  72: "brightness",
  73: "hue",
};

export const velocity = true;
