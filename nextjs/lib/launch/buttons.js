// THE FILE TO CHANGE: the buttons on /launch. Each one is a cue (see lib/stage/README.md) plus the key that fires it.
// Add a line, save, and the page updates. Space (Go) fires them in order, top to bottom.
//
//   key:   the keyboard key ("1"–"9", "q", "w", ...)
//   kind:  sound | video | image | text | color | blackout | stop
//   src:   a file in nextjs/public/samples/ ("/samples/ping.mp3"), one in the repo-root _media/ ("/media/my-clip.mp4"),
//          the words for a text cue, or a CSS color for a color cue
//   color: (optional) the button's color on the page

export const buttons = [
  { key: "1", id: "title", label: "Title card", kind: "text", src: "Installations", options: { size: "11vw" } },
  { key: "2", id: "ping", label: "Ping", kind: "sound", src: "/samples/ping.mp3" },
  { key: "3", id: "dawn", label: "Dawn", kind: "image", src: "/samples/dawn.jpg", options: { fadeIn: 1.5 } },
  { key: "4", id: "chord", label: "Chord (fades)", kind: "sound", src: "/samples/chord.mp3", options: { fadeIn: 1, fadeOut: 2 } },
  { key: "5", id: "fractal", label: "Fractal video", kind: "video", src: "/samples/fractal.mp4", options: { loop: true } },
  { key: "6", id: "red", label: "Red wash", kind: "color", src: "#c0182b", options: { fadeIn: 2 }, color: "#c0182b" },
  { key: "7", id: "wind", label: "Wind (loop)", kind: "sound", src: "/samples/wind.mp3", options: { fadeIn: 3, loop: true } },
  { key: "8", id: "moon", label: "Moon", kind: "image", src: "/samples/moon.svg", options: { fadeIn: 1 } },
  { key: "9", id: "out", label: "Blackout", kind: "blackout", options: { fadeOut: 2 }, color: "#333" },
];
