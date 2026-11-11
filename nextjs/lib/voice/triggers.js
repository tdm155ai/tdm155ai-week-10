// THE FILE TO CHANGE: the words on /voice. Say the word (or phrase), the cue fires on the stage.
// A cue is { kind, src, options } as in lib/stage/README.md. Pick words that are clear and don't come up by accident:
// "moon" works better than "a" or "the". Save, and the page updates.

export const triggers = [
  { say: "hello world", cue: { id: "hello", label: "Hello world", kind: "text", src: "Hello, world" } },
  { say: "light", cue: { id: "light", label: "Light", kind: "color", src: "#fff3c4", options: { fadeIn: 0.5 } } },
  { say: "dark", cue: { id: "dark", label: "Dark", kind: "blackout", options: { fadeOut: 1.5 } } },
  { say: "moon", cue: { id: "moon", label: "Moon", kind: "image", src: "/samples/moon.svg", options: { fadeIn: 1 } } },
  { say: "sun", cue: { id: "sun", label: "Sun", kind: "image", src: "/samples/sun.svg", options: { fadeIn: 1 } } },
  { say: "rose", cue: { id: "rose", label: "Rose", kind: "image", src: "/samples/rose.svg" } },
  { say: "bell", cue: { id: "bell", label: "Bell", kind: "sound", src: "/samples/ping.mp3" } },
  { say: "wind", cue: { id: "wind", label: "Wind", kind: "sound", src: "/samples/wind.mp3", options: { fadeIn: 2 } } },
  { say: "quiet", cue: { id: "quiet", label: "Quiet", kind: "stop", options: { fadeOut: 2 } } },
];
