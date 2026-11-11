"use client";

// From mk-audio-editing (ll-26-27), Bok to the Future, Oct 22: the hand-launch page (task A4), copied into TDM 155AI
// week 10 on 2026-11-11 (source commit 9aa1bd2; the source is unchanged). Changed for this app: clips come from the
// repo-root _media/ (GET /media) and public/samples/ instead of an upload folder; the MediaPipe runtime comes from the
// CDN like the rest of this app (WASM_URL in lib/cv/mediapipe.js) instead of a vision/ route; no uploads.

import { useEffect, useRef, useState } from "react";
import { ACTIONS, GESTURES, defaults, label, midiMessages, stepGate, validMappings } from "./gestures.mjs";
import { createAudio } from "./audio.mjs";
import styles from "./hand-launch.module.css";
import { installMediaPipeInfoFilter, canTrackFrame } from "./mediapipe-runtime.mjs";
import { WASM_URL } from "../../../lib/cv/mediapipe.js";

// Clips to choose from: this repo's generated samples, plus every sound in the repo-root _media/ folder.
const SAMPLE_SOUNDS = ["loop-house.wav", "chord.mp3", "ping.mp3", "thump.mp3", "wind.mp3", "beep-a.mp3"];
const AUDIO_FILE = /\.(wav|mp3|m4a|aac|ogg|oga|flac|aiff?|webm)$/i;

const STORAGE = "hand-launch:mappings:v1";
const MODEL = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const prettyAction = { clip: "Recorded clip", hit: "Synth hit · C4", chord: "Chord · Cmaj7", pattern: "Pattern · toggle", note: "MIDI note", cc: "MIDI CC" };
const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

export default function HandLaunch() {
  const [rows, setRows] = useState(defaults);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState("");
  const [sounds, setSounds] = useState([]);
  const [audioState, setAudioState] = useState("off");
  const [clipStatus, setClipStatus] = useState({});
  const [cameraState, setCameraState] = useState("off");
  const [armed, setArmed] = useState(true);
  const [hold, setHold] = useState(250);
  const [release, setRelease] = useState(300);
  const [threshold, setThreshold] = useState(0.7);
  const [hands, setHands] = useState([]);
  const [metrics, setMetrics] = useState({ inference: 0, interval: 0 });
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [midiStatus, setMidiStatus] = useState("Not connected");
  const [outputs, setOutputs] = useState([]);
  const [outputId, setOutputId] = useState("");
  const video = useRef(null), canvas = useRef(null);
  const runtime = useRef({ rows, hold, release, threshold, armed, outputId, sounds });
  runtime.current = { rows, hold, release, threshold, armed, outputId, sounds };
  const audio = useRef(null), midi = useRef(null), stream = useRef(null), recognizer = useRef(null);
  const releaseInfo = useRef(null);
  const gates = useRef(new Map()), frame = useRef(0), generation = useRef(0), alive = useRef(true), audioPending = useRef(null);

  const log = (text, bad = false) => setEvents((prev) => [{ id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), text, bad }, ...prev].slice(0, 40));
  async function refreshSounds() {
    const response = await fetch("/media", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error("Couldn't list _media/.");
    const media = (data.files || []).filter((url) => AUDIO_FILE.test(url)).map((url) => ({ name: decodeURIComponent(url.replace(/^\/media\//, "")), path: url, url }));
    const samples = SAMPLE_SOUNDS.map((name) => ({ name: `samples/${name}`, path: `/samples/${name}`, url: `/samples/${name}` }));
    if (alive.current) setSounds([...samples, ...media]);
  }
  function panic(announce = true) {
    audio.current?.stop();
    for (const port of midi.current?.outputs.values() || []) {
      if (port.state !== "connected") continue;
      try {
        port.clear(); // Cancel scheduled note-offs before sending a channel-wide panic.
        for (let channel = 0; channel < 16; channel++) {
          port.send([0xb0 + channel, 64, 0]);
          port.send([0xb0 + channel, 120, 0]);
          port.send([0xb0 + channel, 123, 0]);
        }
      } catch { /* A port may have disconnected between enumeration and send. */ }
    }
    gates.current.clear();
    if (announce) log("All sound stopped");
  }
  function stopCamera() {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    recognizer.current?.close(); recognizer.current = null;
    releaseInfo.current?.(); releaseInfo.current = null;
    gates.current.clear();
    canvas.current?.getContext("2d")?.clearRect(0, 0, canvas.current.width, canvas.current.height);
    setHands([]); setCameraState("off");
  }

  useEffect(() => {
    alive.current = true;
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validMappings(parsed)) setRows(parsed);
        else setStorage("Saved mappings were invalid; using defaults.");
      }
    } catch { setStorage("Browser storage unavailable; mappings last for this visit."); }
    setLoaded(true);
    refreshSounds().catch((e) => setError(e.message));
    const hide = () => { if (document.hidden) { panic(false); stopCamera(); setArmed(false); } };
    const escape = (e) => { if (e.key === "Escape") { panic(); setArmed(false); } };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keydown", escape);
    return () => {
      alive.current = false;
      generation.current++;
      cancelAnimationFrame(frame.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      recognizer.current?.close();
      releaseInfo.current?.(); releaseInfo.current = null;
      panic(false);
      audio.current?.dispose(); audio.current = null;
      if (midi.current) midi.current.onstatechange = null;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE, JSON.stringify(rows)); }
    catch { setStorage("Could not save mappings in this browser."); }
    gates.current.clear();
  }, [rows, loaded]);
  useEffect(() => { gates.current.clear(); }, [hold, release, threshold, armed]);
  useEffect(() => {
    if (!audio.current || audioState !== "ready") return;
    // Preload disabled rows too: their Test buttons are intentionally usable.
    const clips = rows.filter((r) => r.action === "clip" && r.clip).map((r) => sounds.find((s) => s.path === r.clip)).filter(Boolean);
    for (const clip of clips) {
      setClipStatus((prev) => ({ ...prev, [clip.path]: "loading" }));
      audio.current.preload(clip.url).then(() => {
        if (alive.current) setClipStatus((prev) => ({ ...prev, [clip.path]: "ready" }));
      }).catch((e) => {
        if (alive.current) { setClipStatus((prev) => ({ ...prev, [clip.path]: "failed" })); setError(`Clip preload failed: ${e.message}`); }
      });
    }
  }, [rows, sounds, audioState]);

  function update(id, patch) {
    // Stop loops/patterns and release MIDI when changing a live mapping.
    panic(false);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  async function enableAudio() {
    if (audioPending.current) return;
    setAudioState("loading"); setError("");
    try {
      audioPending.current = audio.current ? audio.current.context.resume() : createAudio();
      const engine = await audioPending.current;
      if (!audio.current && engine) {
        if (!alive.current) { engine.dispose(); return; }
        audio.current = engine;
      }
      setAudioState("ready");
      log("Audio enabled · clips preload on assignment");
    } catch (e) { setError(e.message); setAudioState("off"); }
    finally { audioPending.current = null; }
  }
  function fire(row, source = "Test", onset = null) {
    try {
      let result;
      if (["note", "cc"].includes(row.action)) {
        const port = midi.current?.outputs.get(runtime.current.outputId);
        if (!port || port.state !== "connected") throw new Error("Connect MIDI and choose a connected output first.");
        const messages = midiMessages(row, performance.now());
        for (const msg of messages) port.send(msg.bytes, msg.at);
        result = row.action === "cc" ? `CC ${messages[0].bytes[1]} = ${messages[0].bytes[2]}` : `MIDI note ${messages[0].bytes[1]}`;
      } else {
        if (!audio.current) throw new Error("Enable audio first.");
        const sound = runtime.current.sounds.find((s) => s.path === row.clip);
        result = audio.current.fire(row, sound?.url);
      }
      const elapsed = onset === null ? "" : ` · ${Math.round(performance.now() - onset)} ms observed → dispatch`;
      log(`${source} → ${result}${elapsed}`);
    } catch (e) { setError(e.message); log(`${source} → ${e.message}`, true); }
  }

  async function startCamera() {
    if (cameraState !== "off") return;
    const token = ++generation.current;
    setCameraState("loading"); setError("");
    let localStream, localRecognizer;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Webcam needs localhost or HTTPS and a supported browser.");
      releaseInfo.current = installMediaPipeInfoFilter();
      const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      localRecognizer = await GestureRecognizer.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL, delegate: "CPU" }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      if (token !== generation.current) { localRecognizer.close(); return; }
      localStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
      if (token !== generation.current) { localStream.getTracks().forEach((t) => t.stop()); localRecognizer.close(); return; }
      stream.current = localStream; recognizer.current = localRecognizer;
      video.current.srcObject = localStream;
      await video.current.play();
      if (token !== generation.current) return;
      setCameraState("on");
      localStream.getVideoTracks()[0].onended = () => { if (token === generation.current) { panic(); stopCamera(); } };
      let lastTime = -1, lastFrame = 0, lastUI = 0, lastInference = -Infinity;
      const tick = () => {
        if (token !== generation.current) return;
        try {
          const now = performance.now();
          if (canTrackFrame(video.current, lastTime, now, lastInference) && now - lastFrame >= 33) {
            const interval = now - lastFrame;
            lastInference = now; lastFrame = now; lastTime = video.current.currentTime;
            const result = localRecognizer.recognizeForVideo(video.current, now);
            const inference = performance.now() - now;
            const detected = result.landmarks.map((points, index) => ({ points, hand: result.handedness[index]?.[0]?.categoryName || "Unknown", gesture: result.gestures[index]?.[0]?.categoryName || "None", score: result.gestures[index]?.[0]?.score || 0 }));
            draw(detected);
            const settings = runtime.current;
            if (settings.armed) for (const row of settings.rows.filter((r) => r.enabled)) {
              const matches = detected.some((h) => h.gesture === row.gesture && h.score >= settings.threshold && (row.hand === "Either" || row.hand === h.hand));
              const { gate, fire: shouldFire } = stepGate(gates.current.get(row.id), matches, now, settings.hold, settings.release);
              gates.current.set(row.id, gate);
              if (shouldFire) fire(row, `${row.hand} ${label(row.gesture)}`, gate.since);
            }
            if (now - lastUI > 150) { setHands(detected); setMetrics({ inference, interval }); lastUI = now; }
          }
          frame.current = requestAnimationFrame(tick);
        } catch (e) { setError(`Tracking stopped: ${e.message}`); panic(); stopCamera(); }
      };
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      localStream?.getTracks().forEach((t) => t.stop());
      if (token !== generation.current) return;
      if (localRecognizer && recognizer.current !== localRecognizer) localRecognizer.close();
      stopCamera();
      setError(`Camera/model: ${e.message}. Check camera permission and internet for the first model download.`);
    }
  }
  function draw(detected) {
    const element = canvas.current, feed = video.current;
    if (!element || !feed) return;
    element.width = feed.videoWidth; element.height = feed.videoHeight;
    const ctx = element.getContext("2d");
    ctx.clearRect(0, 0, element.width, element.height);
    detected.forEach((h) => {
      const points = h.points.map((p) => ({ x: (1 - p.x) * element.width, y: p.y * element.height }));
      ctx.strokeStyle = h.hand === "Left" ? "#9af5be" : "#ffab63"; ctx.lineWidth = 3;
      for (const [a, b] of connections) { ctx.beginPath(); ctx.moveTo(points[a].x, points[a].y); ctx.lineTo(points[b].x, points[b].y); ctx.stroke(); }
      ctx.fillStyle = "#fff";
      points.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI); ctx.fill(); });
      const x = Math.max(8, Math.min(element.width - 270, points[0].x - 100)), y = Math.max(30, Math.min(element.height - 8, points[0].y + 30));
      ctx.fillStyle = "#101510dd"; ctx.fillRect(x - 5, y - 24, 270, 32);
      ctx.fillStyle = "#fff"; ctx.font = "16px system-ui";
      ctx.fillText(`${h.hand} · ${label(h.gesture)} · ${Math.round(h.score * 100)}%`, x, y);
    });
  }
  async function connectMIDI() {
    try {
      if (!navigator.requestMIDIAccess) throw new Error("Web MIDI is unavailable. Try Chrome or Edge on localhost.");
      midi.current = await navigator.requestMIDIAccess({ sysex: false });
      const sync = () => {
        const ports = Array.from(midi.current.outputs.values()).filter((p) => p.state === "connected");
        setOutputs(ports.map((p) => ({ id: p.id, name: p.name || p.id })));
        setOutputId((previous) => ports.some((p) => p.id === previous) ? previous : ports[0]?.id || "");
        setMidiStatus(ports.length ? `${ports.length} output(s) available` : "No outputs. Enable IAC Driver or attach a MIDI device.");
      };
      midi.current.onstatechange = sync; sync();
    } catch (e) { setMidiStatus(e.message); }
  }

  return <main id="main" className={styles.shell}>
    <header className={styles.header}><a href="/launch">← Launch</a><span>FROM MK-AUDIO-EDITING · BOK TO THE FUTURE, OCT 22</span><span className={styles.green}>HAND LAUNCH</span></header>
    <div className={styles.intro}><div><p className={styles.kicker}>A gesture becomes a cue.</p><h1>Sound, by hand<span>.</span></h1><p>Hold a shape. Launch a clip, strike a chord, or send a cue to your DAW.</p></div><div className={styles.controls}><button onClick={enableAudio} disabled={audioState === "loading"}>{audioState === "ready" ? "Audio enabled · resume" : audioState === "loading" ? "Enabling…" : "1 · Enable audio"}</button><button className={styles.primary} onClick={cameraState === "off" ? startCamera : () => { panic(); stopCamera(); }} disabled={cameraState === "loading"}>{cameraState === "on" ? "Stop camera" : cameraState === "loading" ? "Loading model…" : "2 · Start camera"}</button><button className={styles.panic} onClick={() => { panic(); setArmed(false); }}>Stop all · Esc</button></div></div>
    {error && <div role="alert" className={styles.error}>{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    <section className={styles.liveGrid} aria-label="Camera and trigger settings">
      <div className={styles.cameraCard}><div className={styles.cardBar}><span><i className={cameraState === "on" ? styles.dotOn : styles.dot} />{cameraState === "on" ? "CAMERA LIVE" : "CAMERA OFF"}</span><label><input type="checkbox" checked={armed} onChange={(e) => { panic(false); setArmed(e.target.checked); }} /> Gestures armed</label></div><div className={styles.preview}><video ref={video} autoPlay muted playsInline /><canvas ref={canvas} />{cameraState !== "on" && <div className={styles.placeholder}><span>✋</span><strong>{cameraState === "loading" ? "Preparing hand recognition…" : "Your hands are the controls."}</strong><p>Camera frames are processed in this browser.<br />No webcam recording or microphone access.</p></div>}</div><div className={styles.handReadout}>{hands.length ? hands.map((h, i) => <span key={i}>{h.hand}: <strong>{label(h.gesture)}</strong> {Math.round(h.score * 100)}%</span>) : <span>No hands detected</span>}<span>Mirrored preview · model’s Left / Right labels</span></div></div>
      <div className={styles.settings}><p className={styles.kicker}>01 / Recognition</p><h2>Make it deliberate.</h2><p>A shape fires once after the hold time. Release it before the next cue. Changing shapes counts as release.</p><label>Hold before firing <strong>{hold} ms</strong><input aria-label="Hold before firing" type="range" min="50" max="1000" step="25" value={hold} onChange={(e) => setHold(Number(e.target.value))} /></label><label>Release to re-arm <strong>{release} ms</strong><input aria-label="Release to re-arm" type="range" min="100" max="1000" step="25" value={release} onChange={(e) => setRelease(Number(e.target.value))} /></label><label>Minimum confidence <strong>{Math.round(threshold * 100)}%</strong><input aria-label="Minimum confidence" type="range" min="0.4" max="0.95" step="0.05" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label><div className={styles.metrics}><span>Inference <b>{metrics.inference ? `${Math.round(metrics.inference)} ms` : "—"}</b></span><span>Frame interval <b>{metrics.interval ? `${Math.round(metrics.interval)} ms` : "—"}</b></span></div><small>First load downloads the MediaPipe model. Keep this tab visible; switching tabs stops the camera and sound.</small></div>
    </section>
    <section className={styles.section} aria-labelledby="mappings"><div className={styles.sectionTitle}><div><p className={styles.kicker}>02 / Gesture → action</p><h2 id="mappings">Your cue sheet.</h2></div><button onClick={() => setRows((prev) => [...prev, { ...defaults()[0], id: crypto.randomUUID() }])} disabled={rows.length >= 32}>+ Add mapping</button></div><p className={styles.muted}>Pick a clip and enable its row. Test buttons fire immediately, even while gesture detection is disarmed. Duplicate mappings fire together.</p>{storage && <p role="status">{storage}</p>}<div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>On</th><th>Gesture</th><th>Hand</th><th>Action</th><th>Action settings</th><th>Try / remove</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
      <td><input type="checkbox" aria-label={`Enable ${label(row.gesture)} ${row.action}`} checked={row.enabled} onChange={(e) => update(row.id, { enabled: e.target.checked })} /></td>
      <td><select aria-label={`Gesture for ${row.id}`} value={row.gesture} onChange={(e) => update(row.id, { gesture: e.target.value })}>{GESTURES.map((g) => <option key={g}>{g}</option>)}</select></td>
      <td><select aria-label={`Hand for ${row.id}`} value={row.hand} onChange={(e) => update(row.id, { hand: e.target.value })}>{["Either", "Left", "Right"].map((h) => <option key={h}>{h}</option>)}</select></td>
      <td><select aria-label={`Action for ${row.id}`} value={row.action} onChange={(e) => update(row.id, { action: e.target.value })}>{ACTIONS.map((a) => <option key={a} value={a}>{prettyAction[a]}</option>)}</select></td>
      <td>{row.action === "clip" ? <div className={styles.clipSettings}><select aria-label={`Clip for ${row.id}`} value={row.clip || ""} onChange={(e) => update(row.id, { clip: e.target.value })}><option value="">Choose a saved clip…</option>{sounds.map((s) => <option key={s.path} value={s.path}>{s.name}</option>)}</select><label><input type="checkbox" checked={Boolean(row.loop)} onChange={(e) => update(row.id, { loop: e.target.checked })} /> Toggle loop</label><small>{row.clip ? (audioState !== "ready" ? "Enable audio to preload" : clipStatus[row.clip] || "Clip missing from library") : ""}</small></div> : ["note", "cc"].includes(row.action) ? <div className={styles.midiFields}>{[["channel", "Ch", 1, 16, 1], ["number", row.action === "cc" ? "CC" : "Note", 0, 127, 60], ["value", row.action === "cc" ? "Value" : "Vel", 0, 127, 96], ...(row.action === "note" ? [["duration", "ms", 20, 10000, 300]] : [])].map(([key, title, min, max, fallback]) => <label key={key}>{title}<input aria-label={`${title} for ${row.id}`} type="number" min={min} max={max} value={row[key] ?? fallback} onChange={(e) => update(row.id, { [key]: Number(e.target.value) })} /></label>)}</div> : <span className={styles.muted}>{row.action === "pattern" ? "C E G B · 104 BPM · toggle" : row.action === "chord" ? "C4 E4 G4 B4" : "C4 · eighth note"}</span>}</td>
      <td><div className={styles.rowActions}><button disabled={row.action === "clip" && (audioState !== "ready" || clipStatus[row.clip] !== "ready")} onClick={() => fire(row, "Test")}>Test</button><button aria-label={`Remove ${row.id}`} onClick={() => { panic(false); setRows((prev) => prev.filter((r) => r.id !== row.id)); }}>×</button></div></td>
    </tr>)}</tbody></table></div><p className={styles.muted}>Mappings save in this browser. “Either” fires once when either hand matches; use separate Left and Right rows for independent cues.</p></section>
    <div className={styles.bottomGrid}><section className={styles.panel}><p className={styles.kicker}>03 / Recorded clips</p><h2>Bring your sounds.</h2><p>Put audio files in the repo-root <code>_media/</code> folder (any subfolder; it stays out of git), then Refresh. The menu also lists this app's samples in <code>public/samples/</code>.</p><button onClick={() => refreshSounds().catch((e) => setError(e.message))}>Refresh library</button><p className={styles.muted}>{sounds.length} clip(s). Assigned clips preload after audio is enabled. Playback depends on the browser’s codec support. Loops repeat the whole file.</p></section>
      <section className={styles.panel}><p className={styles.kicker}>04 / MIDI out</p><h2>Let the DAW play.</h2><button onClick={connectMIDI}>Connect MIDI</button><p role="status" className={styles.muted}>{midiStatus}</p><label>Output<select aria-label="MIDI output" value={outputId} onChange={(e) => { panic(false); setOutputId(e.target.value); }}><option value="">Choose an output…</option>{outputs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><p>On Mac: Audio MIDI Setup → MIDI Studio → IAC Driver → Device is online. In Logic or Ableton, enable that bus as a MIDI input and arm an instrument track. Use Chrome or Edge on localhost. Enable a MIDI mapping above.</p><p className={styles.muted}>Channels 1–16; note, velocity, CC and value 0–127. Every note includes a scheduled note-off.</p></section></div>
    <section className={styles.section}><div className={styles.sectionTitle}><div><p className={styles.kicker}>05 / Live activity</p><h2>What fired.</h2></div><button onClick={() => setEvents([])}>Clear log</button></div><div className={styles.log} role="log" aria-label="Trigger activity">{events.length ? events.map((e) => <div key={e.id} className={e.bad ? styles.badEvent : ""}><time>{e.time}</time><span>{e.text}</span></div>) : <p>No cues yet. Enable audio and test a mapping, then try a gesture.</p>}</div></section>
    <footer className={styles.footer}><h3>About the delay</h3><p>With the default 250 ms hold, allow roughly 300–500 ms from forming a stable shape to hearing a preloaded cue on a typical laptop. This is an estimate, not a measured acoustic round trip. The log measures first matching frame → dispatch; camera exposure, inference, frame cadence, the 25 ms audio scheduling look-ahead, speaker buffers, Bluetooth, and a DAW’s buffer add delay. The pattern starts immediately rather than waiting for a bar. Initial model download and clip decoding happen before performance.</p><p><a href="https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js">MediaPipe Gesture Recognizer</a> · <a href="https://tonejs.github.io/docs/15.1.22/index.html">Tone.js 15</a> · <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API">Web MIDI</a></p></footer>
  </main>;
}
