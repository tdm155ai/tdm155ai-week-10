// ─────────────────────────────────────────────────────────────────────────────
//  THE FILE TO CHANGE for /voice/shaders: say a word, the fluid splashes.
//  Save it and the page updates. Each word fires one effect; each effect is a few numbers.
// ─────────────────────────────────────────────────────────────────────────────

// What you say → what happens. Whole words; a phrase fires when its words come in order.
// `command` is one of the page's three moves: "play" (start the loop), "stop" (music off, screen to black), "splash".
// `effect` is one of the splashes below.
export const words = [
  { say: "hit it", command: "play" },
  { say: "stop", command: "stop" },
  { say: "splash", effect: "splash" },
  { say: "drop", effect: "drop" },
  { say: "boom", effect: "boom" },
  { say: "ocean", effect: "ocean" },
  { say: "fire", effect: "fire" },
];

// The effects.
//   at:      where it lands: "center", "random", or [x, y] from 0 to 1 (0, 0 is top left)
//   spread:  how far it throws, as a share of the screen (0.1 small, 0.5 huge)
//   streams: how many jets fly out from the middle
//   drops:   bright blobs of color dropped where it lands
//   radius:  how fat each jet and blob is (0.1 thin, 0.5 very fat)
//   colors:  "rainbow", or a list of colors
//   repeat:  how many splashes (each at its own spot), gap: milliseconds between them
export const effects = {
  splash: { label: "Big splash", at: "center", spread: 0.45, streams: 18, drops: 1, radius: 0.3, colors: "rainbow" },
  drop: { label: "A drop", at: "random", spread: 0.12, streams: 6, drops: 1, radius: 0.15, colors: "rainbow" },
  boom: { label: "Three splashes", at: "random", spread: 0.3, streams: 10, drops: 1, radius: 0.22, colors: "rainbow", repeat: 3, gap: 260 },
  ocean: { label: "Ocean", at: "center", spread: 0.5, streams: 18, drops: 1, radius: 0.35, colors: ["#1e90ff", "#00e5ff", "#2b50ff"] },
  fire: { label: "Fire", at: [0.5, 0.75], spread: 0.45, streams: 14, drops: 1, radius: 0.3, colors: ["#ff3b1f", "#ff9a1f", "#ffd21f"] },
};

// The button on the page fires this one.
export const BUTTON = "splash";

// The music "hit it" starts. It loops until "stop". (lib/launch/loop.js makes it; any file in public/ works.)
export const MUSIC = "/samples/loop-house.wav";

// A word fires again once this many seconds have passed (so one long "splaaash" fires once).
export const REARM_SECONDS = 0.6;

// The fluid gets glitchy after a while, so it starts fresh every RESET_SECONDS (and on the Reset button).
export const RESET_SECONDS = 45;
