"use client";

// Choosing the microphone, and seeing that it hears you. Browser-only.
//
//   const mic = useMic();                 // in a component: the list of inputs, the chosen one, and its level
//   const stream = await mic.open();      // when you start listening: opens the chosen mic, the meter starts
//   mic.close();                          // when you stop
//   <MicPicker mic={mic} />               // the menu and the meter (lib/voice/MicPicker.jsx)
//
// The choice is remembered in this browser. OpenAI gets the stream itself. Web Speech is handed the stream's track
// (startListening({ track })); Chrome versions that don't take a track listen to the Mac's default input instead
// (System Settings › Sound › Input).

import { useCallback, useEffect, useRef, useState } from "react";
import { startListening } from "./speech.js";

const STORE = "tdm155ai-mic";

function saved() { try { return localStorage.getItem(STORE) || ""; } catch { return ""; } }
function save(id) { try { id ? localStorage.setItem(STORE, id) : localStorage.removeItem(STORE); } catch {} }

// Every audio input Chrome can see. Labels are blank until the page has had mic permission once.
export async function listMics() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, label: d.label || (d.deviceId === "default" ? "Default input" : `Microphone ${i + 1}`) }));
}

// Open a mic by id ("" = the default). Cleanup (echo cancellation, noise suppression) is on unless raw is true:
// it helps in a noisy room, but can swallow quiet speech; try both.
export async function openMic(id = "", { raw = false } = {}) {
  const audio = { echoCancellation: !raw, noiseSuppression: !raw, autoGainControl: !raw };
  if (id) audio.deviceId = { exact: id };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio });
  } catch (e) {
    if (id && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) { save(""); delete audio.deviceId; return navigator.mediaDevices.getUserMedia({ audio }); }
    throw e;
  }
}

// Loudness of a stream, 0–1-ish (RMS), about 20 times a second. Returns a function that stops it.
export function meter(stream, onLevel) {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    onLevel(Math.sqrt(sum / buf.length));
  }, 50);
  return () => { clearInterval(timer); try { source.disconnect(); ctx.close(); } catch {} };
}

export function useMic() {
  const [mics, setMics] = useState([]);
  const [id, setIdState] = useState("");
  const [raw, setRaw] = useState(false);
  const [level, setLevel] = useState(0);
  const [live, setLive] = useState(false);
  const stream = useRef(null);
  const stopMeter = useRef(null);
  const lastLoud = useRef(0);

  const refresh = useCallback(async () => { try { setMics(await listMics()); } catch {} }, []);
  useEffect(() => {
    setIdState(saved());
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const close = useCallback(() => {
    stopMeter.current?.(); stopMeter.current = null;
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    setLevel(0); setLive(false);
  }, []);

  const open = useCallback(async () => {
    close();
    const s = await openMic(id, { raw });
    stream.current = s;
    setLive(true);
    stopMeter.current = meter(s, (v) => { setLevel(v); if (v > 0.015) lastLoud.current = performance.now(); });
    const track = s.getAudioTracks()[0];
    track?.addEventListener("ended", () => setLive(false)); // unplugged
    refresh(); // labels appear once permission is granted
    return s;
  }, [id, raw, close, refresh]);

  const setId = useCallback((value) => { setIdState(value); save(value); }, []);
  useEffect(() => close, [close]);

  // When the room was last loud enough to be talking (performance.now()), for "it hears you but no words come" checks.
  const loudAt = useCallback(() => lastLoud.current, []);
  const label = mics.find((m) => m.id === id)?.label || "Default input";
  return { mics, id, setId, raw, setRaw, level, live, open, close, loudAt, label, stream };
}

// Web Speech on the chosen mic, with a watchdog: if the meter says someone is talking but no words have come for
// `quietMs`, throw the recognizer away and start a fresh one (Chrome's recognizer sometimes stalls without an error).
// Takes the same options as startListening. Returns a stop function (also closes the mic) with .restarts.
export async function startWebSpeech(mic, { quietMs = 8000, ...options } = {}) {
  let track = null;
  try { track = (await mic.open()).getAudioTracks()[0] || null; }
  catch (e) { options.onError?.(new Error(`mic: ${e.message}. Web Speech will use the Mac's default input.`)); }
  let lastWords = performance.now();
  const stop = startListening({ ...options, track, onResult: (r) => { lastWords = performance.now(); options.onResult?.(r); } });
  const dog = setInterval(() => {
    const now = performance.now();
    if (track && now - mic.loudAt() < 800 && now - lastWords > quietMs) {
      lastWords = now;
      options.onState?.(`restarting: talking but no words for ${Math.round(quietMs / 1000)}s`);
      stop.restart?.();
    }
  }, 1000);
  const done = () => { clearInterval(dog); stop(); mic.close(); };
  Object.defineProperty(done, "restarts", { get: () => stop.restarts || 0 });
  return done;
}
