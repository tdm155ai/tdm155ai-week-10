// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /draw-a-box.
//  Say the word (or click its button, or press its number key) and that clip plays inside the box you drew.
//  `src` is a GIF or a video: /cv/... and /samples/... are in the repo; /media/... is your own file in the repo's
//  _media/ folder (e.g. _media/rain.gif is "/media/rain.gif"). Pick words that are clear when spoken and
//  don't come up by accident in what you're saying while you draw. Save, and the page updates.
// ─────────────────────────────────────────────────────────────────────────────

export const clips = [
  { word: "bars", label: "Color bars", src: "/cv/gifs/bars.gif" },
  { word: "title", label: "Title card", src: "/cv/gifs/title.gif" },
  { word: "gradient", label: "Gradient", src: "/cv/gifs/gradient.gif" },
  { word: "fractal", label: "Fractal", src: "/cv/gifs/fractal.gif" },
  { word: "life", label: "Game of Life", src: "/cv/gifs/life.gif" },
];

// Say this to empty the box.
export const clearWord = "clear";

// CARD COLOR: with "Pick by: card color", hold a colored index card under the camera. The card is the box, and its
// color picks the GIF. `hue` is the color's place on the color wheel (0 red, 30 orange, 55 yellow, 120 green,
// 200 blue, 280 purple); the card's color goes to the nearest one. Grey, white, and black cards pick nothing.
export const cards = [
  { color: "red", hue: 0, label: "Red card: fractal", src: "/cv/gifs/fractal.gif" },
  { color: "yellow", hue: 55, label: "Yellow card: bars", src: "/cv/gifs/bars.gif" },
  { color: "green", hue: 120, label: "Green card: life", src: "/cv/gifs/life.gif" },
  { color: "blue", hue: 210, label: "Blue card: gradient", src: "/cv/gifs/gradient.gif" },
];
