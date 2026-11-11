// THE FILE TO CHANGE for /voice/semantic: topics instead of trigger words. A small AI model listens to the last few
// sentences and decides which topic you're on; that topic's cue comes up. You can talk freely (a lecture, an
// improvised scene): you don't have to say any particular word.
//
//   about: what the topic is, in plain words. The model reads this, so describe it the way you'd brief an operator.
//   words: (optional) words that fire the cue at once if the model has "armed" this topic (thinks it's coming next).
//   cue:   a stage cue (lib/stage/README.md).

export const topics = [
  { id: "night", about: "night, darkness, sleep, dreams, the moon, stars, the sky after sunset", words: ["moon", "stars", "night"],
    cue: { label: "Moon", kind: "image", src: "/samples/moon.svg", options: { fadeIn: 1.5 } } },
  { id: "summer", about: "summer, heat, sunlight, morning, sunrise, beaches, warmth", words: ["sun", "summer", "sunrise"],
    cue: { label: "Sun", kind: "image", src: "/samples/sun.svg", options: { fadeIn: 1.5 } } },
  { id: "love", about: "love, romance, flowers, gardens, beauty, poetry about someone", words: ["rose", "love", "flower"],
    cue: { label: "Rose", kind: "image", src: "/samples/rose.svg", options: { fadeIn: 1.5 } } },
  { id: "weather", about: "storms, wind, weather, the sea, sailing, travel, being outdoors", words: ["wind", "storm", "sea"],
    cue: { label: "Wind", kind: "sound", src: "/samples/wind.mp3", options: { fadeIn: 2, volume: 0.8 } } },
  { id: "math", about: "mathematics, infinity, geometry, repeating patterns, fractals, computers, algorithms", words: ["infinity", "fractal", "pattern"],
    cue: { label: "Fractal", kind: "video", src: "/samples/fractal.mp4", options: { loop: true, fadeIn: 1.5 } } },
  { id: "life", about: "biology, evolution, cells, living things, populations, emergence, simulations of life", words: ["evolution", "cells", "darwin"],
    cue: { label: "Game of Life", kind: "video", src: "/samples/life.mp4", options: { loop: true, fadeIn: 1.5 } } },
];
