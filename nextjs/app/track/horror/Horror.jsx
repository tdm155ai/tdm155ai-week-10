"use client";

// /track/horror: the machinery. A live horror scene for a performer and an operator:
//   - the performer speaks into the mic; the voice comes out of the speakers through a filter (./voice.js);
//   - the camera puts a mask on the performer's face (./masks.js, ./paint.js) and cuts them out of the room;
//   - a ghost (React Bits' GhostCursor) drifts behind them, following someone's hand (pinch: it flares);
//   - the operator switches voices, fires scares, and steps through the monologue (./script.js) with the keyboard,
//     or the page follows the monologue by ear (Chrome's speech recognition) and runs each line's cue itself;
//   - in "catch" mode the performer can speak quietly: each phrase plays back, loud, in the chosen voice, on a pause;
//   - Record makes a video of the picture and the filtered sound, to watch right here.
// What it looks and sounds like is in ./settings.js (the file to change). The picture is ./scene.js.

import { useCallback, useEffect, useRef, useState } from "react";
import GhostCursor from "../../../lib/cv/react-bits/GhostCursor.jsx";
import { loadModel, WASM_URL } from "../../../lib/cv/mediapipe.js";
import { listMics, openMic } from "../../../lib/voice/mic.js";
import { speechSupported, startListening, words } from "../../../lib/voice/speech.js";
import { follow as followScript } from "../../../lib/voice/follow.js";
import { createScene, HEIGHT, WIDTH } from "./scene.js";
import { PAD, paintMask } from "./paint.js";
import { masks } from "./masks.js";
import { startVoice } from "./voice.js";
import { lines, title as scriptTitle } from "./script.js";
import * as settings from "./settings.js";

const VOICE_NAMES = Object.keys(settings.voices);
const MASK_NAMES = ["none", ...Object.keys(masks)];
const SCARES = { z: "heartbeat", x: "whispers", c: "stinger", v: "boom" };
const SEGMENTER_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite";
const NOSE_TIP = 1, THUMB_TIP = 4, INDEX_TIP = 8, WRIST = 0, MIDDLE_BASE = 9;

// MediaPipe's selfie segmenter: for every point of the picture, how sure it is that a person is there.
let segmenterPromise = null;
function loadSegmenter() {
  segmenterPromise ??= (async () => {
    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const make = (delegate) => ImageSegmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate }, runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false });
    return make("GPU").catch(() => make("CPU"));
  })();
  segmenterPromise.catch(() => { segmenterPromise = null; });
  return segmenterPromise;
}

// The first video format this browser records wins: MP4 plays nearly everywhere; WebM is the fallback.
function pickFormat() {
  const formats = ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return formats.find((f) => MediaRecorder.isTypeSupported(f)) ?? "";
}

// The monologue as one list of words, each knowing its line, for following it by ear. Lines in (brackets) are
// stage directions: they have no words to hear, and run only from the keyboard.
const SCRIPT_WORDS = [];
const LINE_START = [];
const LINE_LENGTH = [];
lines.forEach((line, i) => {
  LINE_START[i] = SCRIPT_WORDS.length;
  const said = line.say.trim().startsWith("(") ? [] : words(line.say);
  LINE_LENGTH[i] = said.length;
  for (const w of said) SCRIPT_WORDS.push({ text: w, norm: w.replace(/'/g, ""), line: i, index: SCRIPT_WORDS.length });
});
const CATCH_LABEL = { idle: "listening", catching: "● hearing you", playing: "▶ speaking", cooldown: "…" };

function savedMicId() { try { return localStorage.getItem("tdm155ai-mic") || ""; } catch { return ""; } }
function describe(action) {
  return Object.entries(action).map(([k, v]) => (v === true ? k : k === "ambience" ? `ambience ${v}` : `${k}: ${v}`)).join(" · ");
}

export default function Horror() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const takesRef = useRef(null);
  const paintCanvas = useRef(null);
  const ghostLayer = useRef(null);
  const sceneRef = useRef(null);
  const voiceRef = useRef(null);
  const session = useRef(null); // { camera, mic, raf, models }
  const tracker = useRef({ x: 0.5, y: 0.5, active: true });
  const recorderRef = useRef(null);
  const countdownTimer = useRef(null);

  const [phase, setPhase] = useState("idle"); // idle → starting → running (or error)
  const [message, setMessage] = useState("");
  const [maskName, setMaskName] = useState(settings.startMask);
  const [voiceName, setVoiceName] = useState(settings.startVoice);
  const [follow, setFollow] = useState(settings.ghost.follow);
  const [ghostColor, setGhostColor] = useState(settings.ghost.color);
  const [cutout, setCutout] = useState(settings.look.cutout);
  const [live, setLive] = useState(settings.liveOut);
  const [voiceMode, setVoiceMode] = useState(settings.voiceMode);
  const [catchState, setCatchState] = useState("idle");
  const [byEar, setByEar] = useState(settings.followScript);
  const [heard, setHeard] = useState({ text: "", at: 0 });
  const [earState, setEarState] = useState("");
  const [liveVolume, setLiveVolume] = useState(0.8);
  const [ambience, setAmbience] = useState(settings.ambience);
  const [mics, setMics] = useState([]);
  const [micId, setMicId] = useState("");
  const [seen, setSeen] = useState({ face: false, hand: false, level: 0, fps: 0 });
  const [count, setCount] = useState(0); // countdown before recording
  const [recordingSince, setRecordingSince] = useState(0);
  const [clock, setClock] = useState(0);
  const [takes, setTakes] = useState([]);
  const [shownTake, setShownTake] = useState(null);
  const [lineIndex, setLineIndex] = useState(-1);

  // The loop reads these, so changing them never restarts the camera.
  const opts = useRef({});
  opts.current = { follow, cutout, maskName, live, liveVolume, voiceMode, byEar };
  const catchRef = useRef("idle");
  const lineRef = useRef(-1);
  const ear = useRef({ pos: 0, bases: new Map() }); // where the follower is in SCRIPT_WORDS
  const lastMask = useRef(settings.startMask === "none" ? Object.keys(masks)[0] : settings.startMask);

  // ── the engines follow the controls ──
  useEffect(() => { voiceRef.current?.setPreset(settings.voices[voiceName] ?? settings.voices["my own voice"]); }, [voiceName]);
  useEffect(() => { voiceRef.current?.setLive(live, liveVolume); }, [live, liveVolume]);
  useEffect(() => { voiceRef.current?.setAmbience(ambience); }, [ambience]);
  useEffect(() => { voiceRef.current?.setMode(voiceMode); }, [voiceMode, phase]);
  useEffect(() => {
    if (maskName !== "none") lastMask.current = maskName;
    if (!paintCanvas.current) return;
    paintMask(paintCanvas.current, masks[maskName]);
    sceneRef.current?.setMaskStyle(masks[maskName] ?? { eyes: "mine", mouth: "mine" });
    sceneRef.current?.paintChanged();
  }, [maskName, phase]);
  useEffect(() => { sceneRef.current?.setLook({ ...settings.look, cutout }); }, [cutout, phase]);
  useEffect(() => {
    const models = session.current?.models;
    if (!models) return;
    if (cutout && !models.segmenter) loadSegmenter().then((s) => { models.segmenter = s; }).catch(() => setMessage("The person cutout didn't load (no internet?); the room stays in."));
    if (follow === "hand" && !models.hand) loadModel("hand").then((h) => { models.hand = h; }).catch(() => setMessage("The hand tracker didn't load (no internet?)."));
  }, [cutout, follow, phase]);

  // A mic plugged in after Start (an audio interface, say) shows up in the Mic menu.
  useEffect(() => {
    if (phase !== "running") return undefined;
    const refresh = () => listMics().then(setMics).catch(() => {});
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [phase]);

  useEffect(() => {
    if (!recordingSince) return undefined;
    const timer = setInterval(() => setClock(Math.floor((performance.now() - recordingSince) / 1000)), 250);
    return () => clearInterval(timer);
  }, [recordingSince]);

  // Leave the page: stop the camera, the mic, the sound, and the GPU work.
  useEffect(() => () => {
    clearInterval(countdownTimer.current);
    const s = session.current;
    if (s) {
      cancelAnimationFrame(s.raf);
      s.camera?.getTracks().forEach((t) => t.stop());
      s.mic?.getTracks().forEach((t) => t.stop());
    }
    try { recorderRef.current?.recorder.stop(); } catch {}
    voiceRef.current?.close();
    sceneRef.current?.dispose();
  }, []);
  useEffect(() => () => takes.forEach((t) => URL.revokeObjectURL(t.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── following the monologue by ear ──
  // Chrome's speech recognition hears the mic; each phrase's words are matched to the script from where it was when
  // the phrase began (lib/voice/follow.js), so misheard or skipped words don't lose the place. A line counts as
  // started once two of its words are heard (one, for a short line).
  const onHeard = useRef(null);
  onHeard.current = (r) => {
    setHeard({ text: r.text, at: performance.now() });
    const o = opts.current;
    if (!o.byEar) return;
    if (o.voiceMode === "catch" && (catchRef.current === "playing" || catchRef.current === "cooldown")) return; // that's the speakers
    const e = ear.current;
    const key = `${r.session}:${r.index}`;
    if (!e.bases.has(key)) e.bases.set(key, e.pos);
    const { pos } = followScript(SCRIPT_WORDS, e.bases.get(key), words(r.text));
    if (pos <= e.pos) return;
    e.pos = pos;
    const line = SCRIPT_WORDS[pos - 1].line;
    if (line > lineRef.current && pos - LINE_START[line] >= Math.min(2, LINE_LENGTH[line])) hearLine(line);
  };

  useEffect(() => {
    if (phase !== "running" || !byEar) { setEarState(""); return undefined; }
    if (!speechSupported()) { setEarState("this browser can't follow by ear: use Chrome"); return undefined; }
    const track = session.current?.mic?.getAudioTracks()[0]?.clone() ?? null;
    const stop = startListening({
      track,
      onResult: (r) => onHeard.current(r),
      onState: (state) => setEarState(state),
      onError: (error) => setEarState(error.message),
    });
    return () => { stop(); track?.stop(); };
  }, [phase, byEar, micId]);

  const onGhostRender = useCallback((canvas) => {
    const layer = ghostLayer.current;
    if (!layer) return;
    layer.getContext("2d").drawImage(canvas, 0, 0, layer.width, layer.height);
    sceneRef.current?.ghostChanged();
  }, []);

  async function start() {
    setPhase("starting");
    setMessage("");
    try {
      if (!paintCanvas.current) { paintCanvas.current = document.createElement("canvas"); paintCanvas.current.width = paintCanvas.current.height = PAD; }
      if (!ghostLayer.current) { ghostLayer.current = document.createElement("canvas"); ghostLayer.current.width = 640; ghostLayer.current.height = 360; }
      const video = videoRef.current;
      const camera = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      video.srcObject = camera;
      await video.play();

      let mic = null;
      try { mic = await openMic(savedMicId()); } catch (error) { setMessage(`No mic (${error.name === "NotAllowedError" ? "permission refused" : error.message}): the picture works, the voice filter doesn't.`); }
      const voice = await startVoice(mic, settings.voices[voiceName] ?? settings.voices["my own voice"]);
      voice.setGate(settings.gate);
      voice.setAmbience(ambience);
      voice.setLive(live, liveVolume);
      voice.setCatch({ threshold: settings.catchVoice.threshold, silence: settings.catchVoice.pause, cooldown: settings.catchVoice.deafAfter });
      voice.setMode(voiceMode);
      voice.onCatch((m) => { catchRef.current = m.state; setCatchState(m.state); });
      voiceRef.current = voice;
      if (mic) {
        setMicId(mic.getAudioTracks()[0]?.getSettings().deviceId || "");
        listMics().then(setMics).catch(() => {});
      }

      const scene = createScene(canvasRef.current, paintCanvas.current, ghostLayer.current);
      sceneRef.current = scene;
      const models = { face: null, segmenter: null, hand: null };
      session.current = { camera, mic, raf: 0, models };
      const facePromise = loadModel("face"); // first: it also quiets MediaPipe's INFO lines
      if (cutout) loadSegmenter().then((s) => { models.segmenter = s; }).catch(() => setMessage("The person cutout didn't load (no internet?); the room stays in."));
      if (follow === "hand") loadModel("hand").then((h) => { models.hand = h; }).catch(() => setMessage("The hand tracker didn't load (no internet?)."));
      models.face = await facePromise;
      run(video, scene, models);
      setPhase("running");
    } catch (error) {
      setMessage(error.name === "NotAllowedError" ? "Camera permission was refused. Click the camera icon in the address bar, allow it, and reload." : `Couldn't start: ${error.message}`);
      setPhase("error");
    }
  }

  function run(video, scene, models) {
    const s = session.current;
    const t0 = performance.now();
    let lastTime = -1, stamp = 0, counter = 0, frames = 0, fpsAt = t0, fps = 0, uiAt = 0;
    let nose = null, hand = null, wasPinching = false;
    const target = { x: 0.5, y: 0.5 };
    const tick = () => {
      s.raf = requestAnimationFrame(tick);
      const now = performance.now();
      const t = (now - t0) / 1000;
      const o = opts.current;
      if (video.readyState >= 2 && video.currentTime !== lastTime && scene.takeFrame(video)) {
        lastTime = video.currentTime;
        frames += 1;
        stamp = Math.max(now, stamp + 1);
        try {
          const face = models.face.detectForVideo(scene.trackCanvas, stamp);
          const points = face.faceLandmarks?.[0] ?? null;
          scene.setFace(points);
          nose = points ? scene.screenPoint(points[NOSE_TIP]) : null;
          const jaw = face.faceBlendshapes?.[0]?.categories?.find((c) => c.categoryName === "jawOpen")?.score ?? 0;
          if (settings.look.scream && jaw > 0.6) scene.glitch(120);
          // The face runs on every frame; the cutout and the hand take turns when both are on.
          const both = o.cutout && models.segmenter && o.follow === "hand" && models.hand;
          const odd = (counter += 1) % 2 === 1;
          if (o.cutout && models.segmenter && (!both || odd)) {
            models.segmenter.segmentForVideo(scene.segmentCanvas, stamp, (result) => {
              const masksOut = result.confidenceMasks;
              const mask = masksOut?.[masksOut.length - 1]; // one mask: the person; two: the second is
              if (mask) scene.setPersonMask(mask.getAsFloat32Array(), mask.width, mask.height, 0.4);
            });
          }
          if (o.follow === "hand" && models.hand && (!both || !odd)) {
            const p = models.hand.detectForVideo(scene.trackCanvas, stamp).landmarks?.[0];
            if (p) {
              const size = Math.max(Math.hypot(p[WRIST].x - p[MIDDLE_BASE].x, p[WRIST].y - p[MIDDLE_BASE].y), 1e-6);
              const pinching = Math.hypot(p[THUMB_TIP].x - p[INDEX_TIP].x, p[THUMB_TIP].y - p[INDEX_TIP].y) / size < 0.3;
              if (pinching && !wasPinching) { scene.flare(700); scene.glitch(180); }
              wasPinching = pinching;
              hand = scene.screenPoint(p[INDEX_TIP]);
            } else {
              hand = null;
              wasPinching = false;
            }
          }
        } catch (error) {
          setMessage(`Tracking error: ${error.message}`);
        }
      }
      // Where the ghost goes.
      const drift = { x: 0.5 + Math.sin(t * 0.37) * 0.32, y: 0.45 + Math.sin(t * 0.53 + 1) * 0.22 };
      let goal = drift;
      if (o.follow === "hand" && hand) goal = hand;
      else if (o.follow === "head" && nose) goal = nose;
      else if (o.follow === "orbit" && nose) goal = { x: nose.x + Math.cos(t * 0.9) * 0.24, y: nose.y + Math.sin(t * 0.9) * 0.3 };
      else if (o.follow === "mouse" && s.pointer) goal = s.pointer;
      const ease = o.follow === "hand" && hand ? 0.35 : 0.08;
      target.x += (goal.x - target.x) * ease;
      target.y += (goal.y - target.y) * ease;
      tracker.current = { x: target.x, y: target.y, active: true };

      scene.render(t, settings.look);

      if (now - fpsAt > 1000) { fps = Math.round((frames * 1000) / (now - fpsAt)); frames = 0; fpsAt = now; }
      if (now - uiAt > 150) {
        uiAt = now;
        const level = voiceRef.current?.level() ?? 0;
        setSeen((prev) => {
          const next = { face: Boolean(nose), hand: Boolean(hand), level, fps };
          return prev.face === next.face && prev.hand === next.hand && prev.fps === next.fps && Math.abs(prev.level - next.level) < 0.002 ? prev : next;
        });
      }
    };
    tick();
  }

  async function chooseMic(id) {
    try { localStorage.setItem("tdm155ai-mic", id); } catch {}
    try {
      const stream = await openMic(id);
      session.current?.mic?.getTracks().forEach((t) => t.stop());
      if (session.current) session.current.mic = stream;
      voiceRef.current?.setMic(stream);
      setMicId(id); // after the switch: the by-ear listener restarts on the new mic
    } catch (error) {
      setMessage(`Couldn't open that mic: ${error.message}`);
    }
  }

  // ── recording ──
  function toggleRecord() {
    if (phase !== "running") return;
    if (recorderRef.current) { stopRecording(); return; }
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; setCount(0); return; }
    let n = Math.max(0, settings.countdown);
    if (!n) { startRecording(); return; }
    setCount(n);
    countdownTimer.current = setInterval(() => {
      n -= 1;
      setCount(n);
      if (n <= 0) { clearInterval(countdownTimer.current); countdownTimer.current = null; startRecording(); }
    }, 1000);
  }

  function startRecording() {
    const voice = voiceRef.current;
    const stream = canvasRef.current.captureStream(30);
    voice?.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const mimeType = pickFormat();
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getVideoTracks().forEach((track) => track.stop()); // the sound track keeps going for the next take
      const type = (recorder.mimeType || mimeType || "video/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      const seconds = Math.round((performance.now() - startedAt) / 1000);
      const take = { id: Date.now(), url: URL.createObjectURL(blob), ext: type.includes("mp4") ? "mp4" : "webm", seconds, mask: opts.current.maskName, voice: voiceName };
      setTakes((list) => [take, ...list]);
      setShownTake(take.id);
      setTimeout(() => takesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };
    const startedAt = performance.now();
    recorder.start(1000);
    recorderRef.current = { recorder };
    setRecordingSince(startedAt);
    setClock(0);
  }

  function stopRecording() {
    const r = recorderRef.current;
    recorderRef.current = null;
    setRecordingSince(0);
    if (r?.recorder.state !== "inactive") r?.recorder.stop();
  }

  function deleteTake(id) {
    setTakes((list) => {
      const take = list.find((t) => t.id === id);
      if (take) URL.revokeObjectURL(take.url);
      return list.filter((t) => t.id !== id);
    });
    if (shownTake === id) setShownTake(null);
  }

  // Playing a take back while Live out is on would feed the speakers into the mic: mute live while it plays.
  const onTakePlay = () => voiceRef.current?.setLive(false);
  const onTakeStop = () => voiceRef.current?.setLive(opts.current.live, opts.current.liveVolume);

  // ── the monologue's cues ──
  // Go to line i (from the keys or a click: by ear, the follower calls hearLine) and do its cue.
  function runLine(i) {
    goToLine(i);
    doLine(i);
  }

  function goToLine(i) {
    lineRef.current = i;
    setLineIndex(i);
    ear.current = { pos: i < 0 ? 0 : LINE_START[i], bases: new Map() };
  }

  // The follower heard line i begin. Lines it skipped still set their voice, mask, and ambience (not their scares).
  function hearLine(i) {
    for (let k = lineRef.current + 1; k < i; k++) {
      const { voice, mask, ambience: level } = lines[k].do;
      doLine(k, { voice, mask, ambience: level });
    }
    lineRef.current = i;
    setLineIndex(i);
    doLine(i);
  }

  function doLine(i, action = lines[i]?.do) {
    if (!action) return;
    const scene = sceneRef.current;
    if (action.voice && settings.voices[action.voice]) setVoiceName(action.voice);
    if (action.mask && (action.mask === "none" || masks[action.mask])) setMaskName(action.mask);
    if (typeof action.ambience === "number") setAmbience(action.ambience);
    if (action.scare) voiceRef.current?.scare(action.scare);
    if (action.blackout) scene?.blackout(1400);
    if (action.glitch) scene?.glitch(600);
    if (action.flare) scene?.flare(900);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  }

  // ── the operator's keys ──
  const keys = useRef(null);
  keys.current = (e) => {
    // Keys work everywhere on the page except while typing or choosing from a menu (a ticked checkbox keeps focus).
    if (e.target.closest?.("textarea, select, input:not([type=checkbox]):not([type=range]):not([type=color])") || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (e.target.type === "range" && key.startsWith("arrow")) return;
    if (key === "f") { toggleFullscreen(); return; }
    if (phase !== "running") return;
    if (/^[1-9]$/.test(key) && VOICE_NAMES[Number(key) - 1]) setVoiceName(VOICE_NAMES[Number(key) - 1]);
    else if (SCARES[key]) voiceRef.current?.scare(SCARES[key]);
    else if (key === "b") sceneRef.current?.blackout(1400);
    else if (key === "g") sceneRef.current?.glitch(600);
    else if (key === "m") setMaskName((m) => (m === "none" ? lastMask.current : "none"));
    else if (key === "l") setLive((on) => !on);
    else if (key === "r") toggleRecord();
    else if (key === "arrowright" || key === "pagedown") runLine(Math.min(lines.length - 1, lineRef.current + 1));
    else if (key === "arrowleft" || key === "pageup") goToLine(Math.max(-1, lineRef.current - 1));
    else if (key === "k") setVoiceMode((m) => (m === "catch" ? "live" : "catch"));
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerMove(e) {
    const s = session.current;
    if (!s) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const w = Math.min(rect.width, (rect.height * WIDTH) / HEIGHT), h = (w * HEIGHT) / WIDTH; // the picture inside the stage
    s.pointer = { x: (e.clientX - rect.left - (rect.width - w) / 2) / w, y: (e.clientY - rect.top - (rect.height - h) / 2) / h };
  }

  const running = phase === "running";
  const counting = count > 0;
  const recording = recordingSince > 0;
  const take = takes.find((t) => t.id === shownTake) ?? takes[0];
  const meterPct = Math.min(100, Math.round(Math.sqrt(seen.level) * 260));

  return (
    <div className="cv-page hr-page">
      <div className="cv-head">
        <p className="eyebrow">Track · Horror</p>
        <h1>Make it a horror movie, live.</h1>
        <p className="cv-lede">One person speaks into the mic and the voice comes out of the speakers changed. The camera puts a mask on their face and cuts them out of the room. A ghost drifts behind them, and someone's hand in the picture moves it; pinch and it flares. The operator switches voices, fires scares, and steps through the monologue. <strong>Record</strong> saves the picture and the filtered sound as a video you can watch below. Everything runs in this tab. The file to change is <code>app/track/horror/settings.js</code>. The masks are in <code>masks.js</code> and the monologue in <code>script.js</code>.</p>
      </div>

      <div className="cv-bar">
        <label><span>Mask</span>
          <select value={maskName} onChange={(e) => setMaskName(e.target.value)}>
            {MASK_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label><span>Voice</span>
          <select value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
            {VOICE_NAMES.map((v, i) => <option key={v} value={v}>{i + 1} · {v}</option>)}
          </select>
        </label>
        <label><span>Ghost follows</span>
          <select value={follow} onChange={(e) => setFollow(e.target.value)}>
            <option value="hand">a hand (pinch: flare)</option>
            <option value="orbit">circles the head</option>
            <option value="head">the head</option>
            <option value="mouse">the mouse</option>
          </select>
        </label>
        <label><span>Ghost</span><input type="color" value={ghostColor} onChange={(e) => setGhostColor(e.target.value)} /></label>
        <label className="cv-check"><input type="checkbox" checked={cutout} onChange={(e) => setCutout(e.target.checked)} /> Cut people out of the room</label>
      </div>

      <div className="cv-bar hr-bar-live">
        {!running ? (
          <button type="button" onClick={start} disabled={phase === "starting"}>{phase === "starting" ? "Starting…" : "Start camera + mic"}</button>
        ) : (
          <>
            <label className="cv-check hr-live" title="L"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live out (speakers)</label>
            <label title="K"><span>Voice out</span>
              <select value={voiceMode} onChange={(e) => setVoiceMode(e.target.value)}>
                <option value="catch">catch a phrase, speak it back</option>
                <option value="live">live, as you speak</option>
              </select>
            </label>
            <label className="cv-check"><input type="checkbox" checked={byEar} onChange={(e) => setByEar(e.target.checked)} /> Follow the script by ear</label>
            <label><span>Volume</span><input type="range" min={0} max={1.5} step={0.01} value={liveVolume} onChange={(e) => setLiveVolume(Number(e.target.value))} /></label>
            <label><span>Ambience</span><input type="range" min={0} max={1} step={0.01} value={ambience} onChange={(e) => setAmbience(Number(e.target.value))} /></label>
            {mics.length > 0 && (
              <label><span>Mic</span>
                <select value={micId} onChange={(e) => chooseMic(e.target.value)}>
                  {mics.filter((m) => m.id && m.id !== "default").map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            )}
            <span className="hr-meter" aria-label="voice level"><span style={{ width: `${meterPct}%` }} /></span>
          </>
        )}
        <span className="cv-spacer" />
        <button type="button" className="cv-quiet" onClick={toggleFullscreen}>Full screen (F)</button>
        <button type="button" className={`hr-rec-btn ${recording ? "is-on" : ""}`} onClick={toggleRecord} disabled={!running}>
          {recording ? `■ Stop (${clock}s)` : counting ? `Cancel (${count})` : "● Record (R)"}
        </button>
      </div>
      {message && <p className="cv-muted hr-message">{message}</p>}

      <div className="hr-grid">
        <div>
          <div ref={stageRef} className="hr-stage" onPointerMove={onPointerMove}>
            {running && (
              <div className="hr-ghost-host">
                <GhostCursor
                  key={settings.ghost.trailLength}
                  tracker={tracker}
                  onRender={onGhostRender}
                  color={ghostColor}
                  trailLength={settings.ghost.trailLength}
                  inertia={settings.ghost.inertia}
                  bloomStrength={settings.ghost.bloomStrength}
                  brightness={settings.ghost.brightness}
                  grainIntensity={settings.ghost.grainIntensity}
                  maxDevicePixelRatio={0.75}
                  mixBlendMode="normal"
                  zIndex={0}
                />
              </div>
            )}
            <canvas ref={canvasRef} className="hr-out" width={WIDTH} height={HEIGHT} />
            <video ref={videoRef} className="hr-video" playsInline muted />
            {!running && (
              <div className="hr-poster">
                <p className="hr-poster-title">{phase === "error" ? "Couldn't start" : "Lights off. Headphones or a handheld mic."}</p>
                <button type="button" onClick={start} disabled={phase === "starting"}>{phase === "starting" ? "Loading the camera, the face tracker, and the voice…" : "Start camera + mic"}</button>
                <p className="hr-poster-note">Chrome asks for the camera and the mic. The voice plays out of the speakers right away. In "catch" mode it doesn't listen while it speaks, so it can't feed back; in "live" mode keep the speakers away from the mic.</p>
              </div>
            )}
            {counting && <div className="hr-count">{count}</div>}
            {running && voiceMode === "catch" && <div className={`hr-catch is-${catchState}`}>{CATCH_LABEL[catchState] ?? catchState}</div>}
            {running && byEar && heard.text && performance.now() - heard.at < 4000 && <p className="hr-heard">“{heard.text}”</p>}
            {recording && <div className="hr-rec">● REC {Math.floor(clock / 60)}:{String(clock % 60).padStart(2, "0")}</div>}
            {running && (
              <p className="hr-status">
                face {seen.face ? "✓" : "…"}{follow === "hand" ? ` · hand ${seen.hand ? "✓" : "…"}` : ""} · {seen.fps} fps · {voiceName}{live ? " · LIVE" : " · speakers off"}{byEar ? ` · ear: ${earState || "…"}` : ""}
              </p>
            )}
          </div>

          <section ref={takesRef} className="hr-takes" aria-label="Takes">
            <h2>Takes</h2>
            {!take ? (
              <p className="cv-muted">Press <strong>Record</strong> (or R): a {settings.countdown}-second countdown, then everything in the picture and every sound you hear is recorded until you press it again. The video shows up here to play back.</p>
            ) : (
              <>
                <video key={take.id} className="hr-player" src={take.url} controls playsInline onPlay={onTakePlay} onPause={onTakeStop} onEnded={onTakeStop} />
                <ul className="hr-take-list">
                  {takes.map((t, i) => (
                    <li key={t.id} className={t.id === take.id ? "is-shown" : ""}>
                      <button type="button" className="hr-link" onClick={() => setShownTake(t.id)}>Take {takes.length - i}</button>
                      <span className="cv-muted">{t.seconds}s · {t.mask} · {t.voice}</span>
                      <a className="hr-link" href={t.url} download={`horror-take-${takes.length - i}.${t.ext}`}>Download</a>
                      <button type="button" className="hr-link" onClick={() => deleteTake(t.id)}>Delete</button>
                    </li>
                  ))}
                </ul>
                <p className="cv-muted">Takes live in this tab only. Download the ones you want to keep before you close or reload the page.</p>
              </>
            )}
          </section>
        </div>

        <aside className="hr-side">
          <section className="hr-script" aria-label="Monologue">
            <div className="hr-script-head">
              <h2>“{scriptTitle}”</h2>
              <div>
                <button type="button" className="hr-link" onClick={() => goToLine(-1)}>Restart</button>
                <button type="button" className="hr-next" onClick={() => runLine(Math.min(lines.length - 1, lineRef.current + 1))} disabled={!running}>Next line →</button>
              </div>
            </div>
            <p className="cv-muted">About a minute. With <strong>Follow the script by ear</strong> on, each line's cue happens as soon as its first words are heard; the operator can still press → (or click a line) to jump.</p>
            <ol>
              {lines.map((line, i) => (
                <li key={i} className={i === lineIndex ? "is-now" : i < lineIndex ? "is-done" : ""}>
                  <button type="button" onClick={() => running && runLine(i)}>
                    <span className="hr-say">{line.say}</span>
                    {line.note && <span className="hr-note">({line.note})</span>}
                    {Object.keys(line.do).length > 0 && <span className="hr-cue">{describe(line.do)}</span>}
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="hr-keys" aria-label="Operator keys">
            <h2>Operator keys</h2>
            <dl>
              <dt>→ / ←</dt><dd>next line (does its cue) / back</dd>
              <dt>1–{VOICE_NAMES.length}</dt><dd>{VOICE_NAMES.join(", ")}</dd>
              <dt>Z X C V</dt><dd>heartbeat, whispers, stinger, boom</dd>
              <dt>B · G</dt><dd>blackout (the light dies) · glitch</dd>
              <dt>M</dt><dd>mask on / off</dd>
              <dt>L</dt><dd>live out (speakers) on / off</dd>
              <dt>K</dt><dd>voice out: catch a phrase ↔ live</dd>
              <dt>R · F</dt><dd>record / stop · full screen</dd>
            </dl>
            <p className="cv-muted">A presentation clicker works too: its buttons send PageDown / PageUp, which step through the lines.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
