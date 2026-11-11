// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /draw-a-box.
//  Say the word (or click its button, or press its number key) and that clip plays inside the box you drew.
//  `src` is a video URL: /cv/... and /samples/... are in the repo; /media/... is your own file in the repo's
//  _media/ folder (e.g. _media/rain.mp4 is "/media/rain.mp4"). Pick words that are clear when spoken and
//  don't come up by accident in what you're saying while you draw. Save, and the page updates.
// ─────────────────────────────────────────────────────────────────────────────

export const clips = [
  { word: "bars", label: "Color bars", src: "/cv/bars.mp4" },
  { word: "title", label: "Title card", src: "/cv/title.mp4" },
  { word: "gradient", label: "Gradient", src: "/samples/gradient.mp4" },
  { word: "fractal", label: "Fractal", src: "/samples/fractal.mp4" },
  { word: "life", label: "Game of Life", src: "/samples/life.mp4" },
];

// Say this to empty the box.
export const clearWord = "clear";
