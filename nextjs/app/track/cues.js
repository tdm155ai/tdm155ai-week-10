// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /track and /track/instruments.
//  Save it and the page updates (no reload needed).
//
//  A cue is { id, label, kind, src, options }. Kinds: sound, video, image, text, color, blackout, stop.
//  Media: /samples/... (in the repo: beep-a.mp3, chord.mp3, ping.mp3, thump.mp3, wind.mp3, gradient.mp4,
//  fractal.mp4, life.mp4, dawn.jpg, fractal.jpg, moon.svg, sun.svg, rose.svg) or /media/... (your own files in _media/).
//  The full list of kinds and options is in lib/stage/stage.js.
// ─────────────────────────────────────────────────────────────────────────────

// HELLO WORLD (/track): zones on the camera picture. Put an index fingertip in a zone and its cue fires, once.
// Take your hand out to re-arm it. x, y, w, h are fractions of the picture (0 to 1), measured from the top left
// of what you see on screen.
export const zones = [
  { name: "Raise a hand", x: 0, y: 0, w: 1, h: 0.2, cue: { id: "hello", label: "Hello, world", kind: "text", src: "Hello, world", options: { size: "12vw" } } },
  { name: "Left: red", x: 0, y: 0.35, w: 0.2, h: 0.4, cue: { id: "red", label: "Red", kind: "color", src: "#ff3b2f" } },
  { name: "Right: ping", x: 0.8, y: 0.35, w: 0.2, h: 0.4, cue: { id: "ping", label: "Ping", kind: "sound", src: "/samples/ping.mp3" } },
];

// INSTRUMENTS (/track/instruments): what each one fires.
export const instruments = {
  // A hand as a fader: the index fingertip's height (bottom 0, top 1) sets a stage control continuously.
  // param: "brightness", "opacity", "master" (volume of every sound), or "hue".
  fader: { param: "brightness" },

  // Pinch thumb and index finger together.
  pinch: { cue: { id: "pinch", label: "Pinch: thump", kind: "sound", src: "/samples/thump.mp3" } },

  // The gesture recognizer's seven gestures. Delete a line to ignore that gesture.
  gestures: {
    Thumb_Up: { id: "sun", label: "Thumbs up: sun", kind: "image", src: "/samples/sun.svg", options: { fit: "contain" } },
    Open_Palm: { id: "gradient", label: "Open palm: gradient", kind: "video", src: "/samples/gradient.mp4", options: { loop: true } },
    Closed_Fist: { id: "fist", label: "Fist: blackout", kind: "blackout" },
    Victory: { id: "moon", label: "Victory: moon", kind: "image", src: "/samples/moon.svg", options: { fit: "contain" } },
    Pointing_Up: { id: "up", label: "Pointing up: chord", kind: "sound", src: "/samples/chord.mp3" },
    Thumb_Down: { id: "stop", label: "Thumbs down: stop sounds", kind: "stop" },
    ILoveYou: { id: "rose", label: "I love you: rose", kind: "image", src: "/samples/rose.svg", options: { fit: "contain" } },
  },

  // Open your mouth wide (the face model's "jawOpen" number goes past `threshold`).
  mouth: { threshold: 0.45, cue: { id: "mouth", label: "Mouth open: fractal", kind: "video", src: "/samples/fractal.mp4", options: { loop: true } } },

  // Both wrists above your nose.
  arms: { cue: { id: "arms", label: "Arms up: dawn", kind: "image", src: "/samples/dawn.jpg" } },

  // Your hand scrubs a video: the clip goes on the stage when you pick this instrument, your index fingertip's
  // left-right position is the position in the clip, and a pinch lets it play on from there.
  video: { cue: { id: "scrub-clip", label: "Video to scrub", kind: "video", src: "/samples/life.mp4", options: { loop: true } } },
};
