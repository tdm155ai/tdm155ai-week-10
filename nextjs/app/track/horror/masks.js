// ─────────────────────────────────────────────────────────────────────────────
//  THE FACES for /track/horror. Each one is painted on a flat face that the page stretches over yours, and says what
//  your eyes and mouth do. Copy one, rename it, change a color or a number, save: it's in the Mask menu.
// ─────────────────────────────────────────────────────────────────────────────
//
//  eyes:  "void" (black holes), "glow" (black holes with a burning pupil that follows where you look), "mine" (yours)
//  mouth: "void" (open your mouth and it's a black hole) or "mine"
//  glow:  the color of the burning pupils
//  paint(p): what gets painted, in order (later paint goes on top). The helpers:
//    p.skin(color, opacity)              the whole face
//    p.sockets(color, size, opacity)     dark rings around the eyes (size 1 = the eye, 2 = twice as wide)
//    p.lips(color)                       the lips
//    p.tears(color, length)              streaks running down from the eyes
//    p.cracks(color, count)              cracks, like a broken doll
//    p.veins(color, count, opacity)      thin branching veins
//    p.blotches(color, count, opacity)   rot
//    p.stitches(color, from, to, count)  stitches between two face points (MediaPipe's face map numbers; 61 and 291
//                                        are the corners of the mouth, 147 and 376 the cheeks, 10 the top of the forehead)
//    p.teeth(color, gapColor)            teeth painted over the lips
//    p.noseHole(color)                   a skull's nose
//    p.cheekHollows(color, opacity)      sunken cheeks
//    p.ctx, p.at(i)                      draw anything with the canvas: p.at(i) is [x, y] of face point i (0–1024)

export const masks = {
  "pale ghost": {
    eyes: "void",
    mouth: "void",
    paint(p) {
      p.skin("#d8dcdc", 0.92);
      p.blotches("#7d8a8f", 26, 0.22);
      p.veins("#3e5566", 10, 0.55);
      p.sockets("#0c0a0e", 2.4, 0.95);
      p.lips("#1a1216");
      p.tears("#060505", 1.1);
    },
  },

  skull: {
    eyes: "glow",
    mouth: "void",
    glow: "#ff2a1a",
    paint(p) {
      p.skin("#e6dfcc", 0.95);
      p.cheekHollows("#2a251e", 0.7);
      p.sockets("#000000", 2.8, 1);
      p.noseHole("#000000");
      p.teeth("#e9e2cf", "#1b1814");
      p.cracks("#6a6253", 6);
    },
  },

  "broken doll": {
    eyes: "glow",
    mouth: "mine",
    glow: "#c9f6ff",
    paint(p) {
      p.skin("#f1e7dc", 0.88);
      p.cracks("#3a2d28", 18);
      p.sockets("#2b1010", 1.7, 0.8);
      p.lips("#7a0f16");
      p.stitches("#1a0d0d", 61, 147, 6);
      p.stitches("#1a0d0d", 291, 376, 6);
    },
  },

  "no face": {
    eyes: "void",
    mouth: "void",
    paint(p) {
      p.sockets("#000000", 1.8, 0.7);
      p.tears("#000000", 1.6);
    },
  },
};
