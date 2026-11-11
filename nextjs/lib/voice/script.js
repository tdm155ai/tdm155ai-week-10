// THE FILE TO CHANGE for /voice/script: the text you'll read, with cues marked in it, and what each cue does.
//
// Put [[name]] right after a word: the cue fires when the reader says that word. Pick cue words that are clear
// and that a recognizer gets right ("rough winds" yes, "thee" no). The cues below are ordinary stage cues
// (lib/stage/README.md). You can also paste a different text on the page.
//
// Sonnet 18, William Shakespeare (1609): public domain.

export const title = "Sonnet 18";

export const text = `Shall I compare thee to a summer's day? [[title]]
Thou art more lovely and more temperate: [[warm]]
Rough winds [[wind]] do shake the darling buds of May,
And summer's lease hath all too short a date;
Sometime too hot the eye of heaven [[sun]] shines,
And often is his gold complexion dimm'd; [[dim]]
And every fair from fair sometime declines,
By chance or nature's changing course untrimm'd; [[drift]]
But thy eternal summer shall not fade, [[chord]]
Nor lose possession of that fair thou ow'st;
Nor shall death [[dark]] brag thou wander'st in his shade,
When in eternal lines to time thou grow'st: [[moon]]
So long as men can breathe or eyes can see, [[still]]
So long lives this, and this gives life to thee. [[end]]`;

export const cues = {
  title: { label: "Title", kind: "text", src: "Sonnet 18", options: { size: "10vw", fadeIn: 1.5 } },
  warm: { label: "Warm wash", kind: "color", src: "#f2a65a", options: { fadeIn: 3 } },
  wind: { label: "Wind", kind: "sound", src: "/samples/wind.mp3", options: { fadeIn: 1.5, volume: 0.8 } },
  sun: { label: "Sun", kind: "image", src: "/samples/sun.svg", options: { fadeIn: 1 } },
  dim: { label: "Dim", kind: "color", src: "#3a2a1c", options: { fadeIn: 2.5 } },
  drift: { label: "Drifting color", kind: "video", src: "/samples/gradient.mp4", options: { loop: true, fadeIn: 3 } },
  chord: { label: "Chord", kind: "sound", src: "/samples/chord.mp3", options: { fadeIn: 1, fadeOut: 2 } },
  dark: { label: "Dark", kind: "color", src: "#000", options: { fadeIn: 0.8 } },
  moon: { label: "Moon", kind: "image", src: "/samples/moon.svg", options: { fadeIn: 2.5 } },
  still: { label: "Quiet", kind: "stop", options: { fadeOut: 3 } },
  end: { label: "Last line", kind: "text", src: "So long lives this, and this gives life to thee.", options: { size: "5vw", fadeIn: 2 } },
};
