// The stage contract: every mechanic (keys, buttons, MIDI, voice, tracking, draw-a-box) fires a cue, and the stage
// (/stage, a full-screen black window for the projector) plays it. Tabs on the same machine talk over a
// BroadcastChannel: no server, no setup. Browser-only: call these from a "use client" component or an event handler.
//
//   import { fireCue, panic, openStage } from "../lib/stage/stage.js";
//   fireCue({ id: "rain", label: "Rain", kind: "video", src: "/samples/waves.mp4", options: { loop: true } });
//
// A cue is { id, label, kind, src, options }. Kinds:
//   sound     src = an audio URL. options: volume (0–1, default 1), fadeIn, fadeOut (seconds), loop. Sounds layer:
//             several can play at once; firing the same id again restarts it.
//   video     src = a video URL. options: loop, muted (default true), volume, fit ("cover" | "contain"), fadeIn.
//   image     src = an image URL. options: fit, fadeIn.
//   text      src = the words (or options.text). options: color, background, size (CSS, e.g. "12vw"), font, fadeIn.
//   color     src = any CSS color ("#ff6b57", "crimson", "linear-gradient(...)"). options: fadeIn.
//   blackout  fades the picture to black and the sounds out. options: fadeOut (default 1).
//   stop      fades sounds out. options: target (a sound cue's id; omit for all), fadeOut (default 1).
// Pictures (video, image, text, color) replace one another, cross-fading over options.fadeIn (default 0.3 s).
// Media URLs: /samples/... (nextjs/public/samples/, in the repo) or /media/... (the repo-root _media/ folder, gitignored).
//
// Continuous controls (a MIDI dial, a hand's height) use setParam(name, value) with value 0–1:
//   "master" (volume of every sound), "opacity" (the picture), "brightness" (the picture), "hue" (rotates its colors).
// and for the video on top: "scrub" (its position, 0 = start, 1 = end; holds that frame), "speed" (0 = quarter speed,
// 0.5 = normal, 1 = four times; plays), "play" (1 plays, 0 pauses).
// Effects on every stage sound (lib/stage/fx.js; a Kaoss pad at /launch/xy): "filter" (0.5 = off, below = low-pass
// sweep, above = high-pass), "resonance", "echo" (amount), "echoTime" (40 ms to 1 s).

export const CHANNEL = "tdm155ai-stage";
export const KINDS = ["sound", "video", "image", "text", "color", "blackout", "stop"];
export const PARAMS = ["master", "opacity", "brightness", "hue", "scrub", "speed", "play", "filter", "resonance", "echo", "echoTime"];

let channel = null;
function bus() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL);
  return channel;
}

function send(message) {
  const b = bus();
  if (!b) return;
  b.postMessage({ ...message, at: Date.now() });
}

// Fire one cue on every open stage. Returns the cue as sent (with an id and label filled in).
export function fireCue(cue) {
  if (!cue || !cue.kind) throw new Error("fireCue needs a cue with a kind (sound, video, image, text, color, blackout, stop)");
  const sent = { id: cue.id || `${cue.kind}-${Date.now()}`, label: cue.label || cue.id || cue.kind, kind: cue.kind, src: cue.src ?? "", options: cue.options || {} };
  send({ type: "cue", cue: sent });
  return sent;
}

// Black out the picture and fade every sound: the panic button. Also puts the stage effects (filter, echo) back to
// neutral, so a sound fired next isn't left muffled.
export function panic(fadeOut = 0.5) {
  const sent = fireCue({ id: "panic", label: "Panic", kind: "blackout", options: { fadeOut } });
  setParam("filter", 0.5); setParam("resonance", 0); setParam("echo", 0);
  return sent;
}

// Set a continuous control, value 0–1 (see PARAMS above).
export function setParam(name, value) {
  send({ type: "param", name, value: Math.max(0, Math.min(1, Number(value) || 0)) });
}

// Open the stage in its own window (drag it to the projector and press F for full screen). Reuses the window if open.
export function openStage() {
  return window.open("/stage", "tdm155ai-stage", "popup,width=960,height=540");
}

// Listen to the stage bus: every cue, param, and status message from any tab. Returns a function that stops listening.
// The stage answers a "ping" with { type: "status", ... }, so a controller can tell whether a stage is open.
export function onStage(callback) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const listener = new BroadcastChannel(CHANNEL);
  listener.onmessage = (event) => callback(event.data);
  return () => listener.close();
}

export function pingStage() {
  send({ type: "ping" });
}
