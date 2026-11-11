// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /track/horror: a live horror scene. Your voice comes out of the speakers through a filter,
//  your face gets a mask, a ghost (moved by someone's hand) drifts behind you, and Record makes a video you can watch
//  on the same page. Save this file and the page updates. The masks are in ./masks.js; the monologue in ./script.js.
// ─────────────────────────────────────────────────────────────────────────────

// What the page starts with: a mask from ./masks.js (or "none") and a voice from `voices` below.
export const startMask = "pale ghost";
export const startVoice = "possessed";

// The voice filters (keys 1–5 switch between them, in this order). Each number is a knob:
//   pitch        the pitch of your voice: 1 = yours, 0.5 = an octave lower, 1.5 = higher
//   double       a second copy of your voice at the same time, 0 (none) to 1 (as loud as the first)
//   doublePitch  the second copy's pitch
//   growl        distortion, 0 to 1
//   lowCut       drop everything below this many Hz (thinner)
//   highCut      drop everything above this many Hz (muffled)
//   wobble       a tremble, 0 to 1, wobbleHz times a second (5 = shaky, 40+ = robot / broken radio)
//   echo         repeats, 0 to 1, echoTime seconds apart
//   reverb       a big empty room, 0 to 1
export const voices = {
  "my own voice": { pitch: 1, double: 0, doublePitch: 1, growl: 0, lowCut: 20, highCut: 16000, wobble: 0, wobbleHz: 1, echo: 0, echoTime: 0.3, reverb: 0.08 },
  ghost: { pitch: 1.12, double: 0.45, doublePitch: 0.84, growl: 0, lowCut: 450, highCut: 7000, wobble: 0.25, wobbleHz: 5, echo: 0.4, echoTime: 0.38, reverb: 0.75 },
  possessed: { pitch: 0.5, double: 0.65, doublePitch: 1, growl: 0.25, lowCut: 60, highCut: 4200, wobble: 0, wobbleHz: 1, echo: 0.12, echoTime: 0.31, reverb: 0.35 },
  demon: { pitch: 0.6, double: 0, doublePitch: 1, growl: 0.55, lowCut: 70, highCut: 2600, wobble: 0.15, wobbleHz: 28, echo: 0.1, echoTime: 0.24, reverb: 0.3 },
  "broken radio": { pitch: 0.85, double: 0, doublePitch: 1, growl: 0.7, lowCut: 500, highCut: 2800, wobble: 0.75, wobbleHz: 47, echo: 0.05, echoTime: 0.12, reverb: 0.15 },
};

// How the voice reaches the speakers (the "Voice out" menu; K switches):
//   "catch": say a phrase (quietly is fine); the moment you pause, it plays the phrase back, loud, in the chosen voice.
//            It doesn't listen while it plays, so the speakers can't feed back into the mic.
//   "live":  straight through as you speak, no wait; keep the speakers away from the mic.
export const voiceMode = "catch";

// The voice plays out of the speakers from the start (and is always in the recording). L turns the speakers off.
export const liveOut = true;

// Catching a phrase: talking starts above `threshold` (0–1; lower it if quiet words aren't caught, raise it if the room
// sets it off), a `pause` this many seconds long ends the phrase and plays it, and for `deafAfter` seconds after
// playing it ignores the mic, so the speakers' echo isn't caught as a new phrase.
export const catchVoice = { threshold: 0.008, pause: 0.3, deafAfter: 0.6 };

// Follow the script by ear: Chrome's speech recognition listens to the mic, follows ./script.js, and runs each line's
// cue (voice, mask, scares) as soon as its first words are heard. Needs the internet (Google's recognizer).
export const followScript = true;

// The mic: sounds quieter than `gate` (0–1) are shut out, so the room's hum and the speakers don't leak in.
// Raise it if the filter keeps rumbling between words; lower it if it cuts the start of quiet words.
export const gate = 0.012;

// The drone and wind under everything (0 = none, 1 = loud). Keys: Z heartbeat, X whispers, C stinger, V boom.
export const ambience = 0.35;

// The ghost: React Bits' GhostCursor (the same as /track/effects/ghost).
export const ghost = {
  color: "#8fe3cf",   // pale, sickly green; try "#b497cf" (violet) or "#ff3b30" (blood)
  follow: "hand",     // "hand" (whoever's index fingertip is in the picture; pinch to make it flare),
                      // "orbit" (circles your head), "head" (trails behind your head), or "mouse"
  trailLength: 45,
  inertia: 0.6,
  bloomStrength: 0.45,
  brightness: 0.8,
  grainIntensity: 0.06,
};

// The picture.
export const look = {
  cutout: true,       // cut the people out of the room, so only the ghost is behind them (false: keep the room)
  room: 0.0,          // with cutout on, how much of the real room still shows (0–1)
  you: 0.95,          // how bright the people are
  colorless: 0.85,    // 0 = full color, 1 = black and white
  contrast: 1.35,
  tint: "#c9e6dc",    // multiplied over the people: cold green-grey
  ghostOnYou: 0.25,   // how much of the ghost drifts in front of the people
  maskShading: 0.6,   // 0 = the mask is flat paint, 1 = lit by the room like real skin
  grain: 0.09,
  vignette: 0.9,
  flicker: 0.5,       // how often the light fails (0–1); B is a blackout on demand
  glitch: 0.2,        // how often the picture tears (0–1); G on demand
  scream: true,       // open your mouth wide and the picture tears
};

// Seconds of countdown before Record starts.
export const countdown = 3;
