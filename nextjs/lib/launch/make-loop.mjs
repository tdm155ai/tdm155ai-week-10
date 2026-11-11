// Save the loop from lib/launch/loop.js as a WAV file, to use anywhere (a stage cue, QLab, a DAW). From nextjs/:
//
//   node lib/launch/make-loop.mjs                          → public/samples/loop-house.wav (the one in the repo)
//   node lib/launch/make-loop.mjs ../_media/my-loop.wav    (your own versions: keep them in _media/, out of the repo)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BARS, BPM, renderLoop } from "./loop.js";

const { rate, length, tracks, scale } = renderLoop();
const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(process.argv[2] || resolve(here, "../../public/samples/loop-house.wav"));

// A 16-bit mono WAV: a 44-byte header, then the samples.
const data = Buffer.alloc(44 + length * 2);
data.write("RIFF", 0); data.writeUInt32LE(36 + length * 2, 4); data.write("WAVEfmt ", 8);
data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24);
data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(length * 2, 40);
for (let i = 0; i < length; i++) {
  let sum = 0;
  for (const k in tracks) sum += tracks[k][i];
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sum * scale * 32767))), 44 + i * 2);
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, data);
console.log(`${outPath}: ${BARS} bars at ${BPM} BPM, ${(length / rate).toFixed(2)} s`);
