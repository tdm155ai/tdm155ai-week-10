"use client";

// FingerSounds: the camera, the hand tracking loop, and the pads.
//
// Each video frame goes to MediaPipe's HandLandmarker, which finds the hands.
// lib/hands.js turns that into pinches; a pinch plays its pad's sound and draws
// a burst at the fingertips. Per-frame work uses refs, not React state, so the
// page doesn't re-render 30–60 times a second.

import { useCallback, useEffect, useRef, useState } from "react";
import { drawScene } from "./lib/draw.js";
import { loadHandTracker } from "./lib/hand-tracker.js";
import { FINGERS, THUMB_TIP, closeness, createPinchState, fingerGaps, readHands, updatePinch } from "./lib/hands.js";
import { Looper } from "./lib/looper.js";
import { DEFAULT_PADS } from "./lib/pads.js";
import { SoundBoard } from "./lib/sound-board.js";
import { SOUNDS, SOUND_IDS } from "./lib/sounds.js";
import LoopPanel from "./LoopPanel.jsx";

// The two hands, in the order their pads appear on the page.
const SIDES = ["left", "right"];

function cameraErrorText(error) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser can only use the camera on localhost or an https:// address. Run `pnpm dev:https` to use it from another computer.";
  }
  if (error?.name === "NotAllowedError") return "The browser didn't allow the camera. Allow it from the address bar, then press Start camera again.";
  if (error?.name === "NotFoundError") return "No camera found. Plug one in, then press Start camera again.";
  if (error?.name === "NotReadableError") return "The camera is busy in another app. Close that app, then press Start camera again.";
  return `The camera didn't start (${error?.message || error}).`;
}

export default function FingerSounds() {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const padEls = useRef(new Map());
  const boardRef = useRef(null);
  const looperRef = useRef(null);
  const trackerRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const track = useRef({
    lastVideoTime: -1,
    hands: [],
    pinch: { left: createPinchState(), right: createPinchState() },
    bursts: [],
    frames: 0,
    since: 0,
  });

  const [pads, setPads] = useState(DEFAULT_PADS);
  const [settings, setSettings] = useState({ reach: 0.3, volume: 0.8, showCamera: true, mirror: true, swapHands: false });
  const [model, setModel] = useState({ state: "loading", detail: "" });
  const [camera, setCamera] = useState({ state: "off", error: "" });
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [aspect, setAspect] = useState(16 / 9);
  const [live, setLive] = useState({ hands: 0, fps: 0 });
  const [notice, setNotice] = useState("");
  const [loop, setLoop] = useState(null);
  const [files, setFiles] = useState([]); // audio files loaded into the page: [{ key, name }]

  const padsRef = useRef(pads);
  const settingsRef = useRef(settings);
  useEffect(() => {
    padsRef.current = pads;
  }, [pads]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  // ---------- sound ----------

  const flashPad = useCallback((padId) => {
    const el = padEls.current.get(padId);
    if (!el) return;
    el.classList.remove("hit");
    void el.offsetWidth; // restart the flash animation
    el.classList.add("hit");
  }, []);

  useEffect(() => {
    const board = new SoundBoard();
    const looper = new Looper(board);
    boardRef.current = board;
    looperRef.current = looper;
    looper.onChange = setLoop;
    // As the loop plays each hit, flash the pads that have that sound, on time.
    looper.onHit = (hit, when) => {
      const delay = Math.max(0, (when - board.ctx.currentTime) * 1000);
      setTimeout(() => {
        for (const pad of padsRef.current) if (pad.sound === hit.sound) flashPad(pad.id);
      }, delay);
    };
    setLoop(looper.snapshot());
    return () => {
      looper.dispose();
      board.close();
    };
  }, [flashPad]);

  useEffect(() => {
    boardRef.current?.setVolume(settings.volume);
  }, [settings.volume]);

  // Plays a pad. `at` (where on the stage) is given only for camera pinches.
  const trigger = useCallback(
    (pad, at) => {
      const board = boardRef.current;
      if (!board || !pad) return;
      board.play(board.buffer(pad.sound));
      flashPad(pad.id);
      if (at) track.current.bursts.push({ ...at, color: FINGERS[pad.finger].color, t: performance.now() });
      looperRef.current?.record(pad.sound, { fromCamera: Boolean(at) });
    },
    [flashPad],
  );

  useEffect(() => {
    function onKey(event) {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target?.closest?.("select, textarea, input[type=text], input[type=number]")) return;
      const looper = looperRef.current;
      const key = event.key.toLowerCase();
      if (event.code === "Space" || key === "r" || key === "z") {
        event.preventDefault();
        // Let go of a focused button, so Space doesn't also press it.
        if (event.target?.closest?.("button")) event.target.blur();
        if (event.code === "Space") looper?.togglePlay();
        else if (key === "r") looper?.toggleRecord();
        else looper?.undo();
        return;
      }
      const pad = padsRef.current.find((p) => p.key === key);
      if (!pad) return;
      event.preventDefault();
      boardRef.current?.unlock();
      trigger(pad);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trigger]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function loadFile(pad, file) {
    if (!file || !boardRef.current) return;
    try {
      const key = await boardRef.current.addFile(file);
      setFiles((all) => [...all, { key, name: file.name }]);
      setPads((all) => all.map((p) => (p.id === pad.id ? { ...p, sound: key } : p)));
    } catch {
      setNotice(`Couldn't read “${file.name}” as a sound file.`);
    }
  }

  function chooseSound(pad, sound) {
    setPads((all) => all.map((p) => (p.id === pad.id ? { ...p, sound } : p)));
  }

  // ---------- hand model ----------

  useEffect(() => {
    let alive = true;
    loadHandTracker()
      .then((tracker) => {
        if (!alive) return;
        trackerRef.current = tracker;
        setModel({ state: "ready", detail: `${tracker.delegate}${tracker.offline ? "" : ", loaded from the internet"}` });
      })
      .catch((error) => alive && setModel({ state: "error", detail: String(error?.message || error) }));
    return () => {
      alive = false;
    };
  }, []);

  // ---------- the tracking loop (once per video frame) ----------

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const updatePads = useCallback((side, hand, reach) => {
    for (const pad of padsRef.current) {
      if (pad.hand !== side) continue;
      const el = padEls.current.get(pad.id);
      if (!el) continue;
      const level = hand ? closeness(hand.gaps[pad.finger], reach) : 0;
      el.style.setProperty("--level", level.toFixed(3));
      el.classList.toggle("held", hand?.active === pad.finger);
    }
  }, []);

  const step = useCallback(
    function frame() {
      rafRef.current = requestAnimationFrame(frame);
      const s = settingsRef.current;
      const state = track.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = trackerRef.current?.landmarker;
      const now = performance.now();

      if (landmarker && video?.readyState >= 2 && video.currentTime !== state.lastVideoTime) {
        state.lastVideoTime = video.currentTime;
        let result;
        try {
          result = landmarker.detectForVideo(video, now);
        } catch (error) {
          console.warn("Hand tracking skipped a frame:", error);
          return;
        }
        const hands = readHands(result, { swap: s.swapHands });
        const frameSize = { width: video.videoWidth, height: video.videoHeight };
        for (const side of SIDES) {
          const hand = hands.find((h) => h.hand === side);
          const pinch = state.pinch[side];
          if (!hand) {
            pinch.finger = null;
            updatePads(side, null, s.reach);
            continue;
          }
          hand.gaps = fingerGaps(hand, frameSize);
          const finger = updatePinch(pinch, hand.gaps, now, s.reach);
          hand.active = pinch.finger;
          updatePads(side, hand, s.reach);
          if (finger !== null) {
            const pad = padsRef.current.find((p) => p.hand === side && p.finger === finger);
            const a = hand.points[THUMB_TIP];
            const b = hand.points[FINGERS[finger].tip];
            trigger(pad, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          }
        }
        state.hands = hands;
        state.frames += 1;
      }

      if (canvas) {
        const ctx = canvas.getContext("2d");
        const looper = looperRef.current;
        drawScene(ctx, {
          hud: looper?.playing ? { pos: looper.position(), beats: looper.beats, recording: looper.recording } : null,
          width: canvas.width,
          height: canvas.height,
          dpr: window.devicePixelRatio || 1,
          hands: state.hands,
          bursts: state.bursts,
          mirror: s.mirror,
          reach: s.reach,
          now,
        });
      }

      if (now - state.since >= 500) {
        const fps = state.since ? Math.round((state.frames * 1000) / (now - state.since)) : 0;
        const handsInView = state.hands.length;
        state.frames = 0;
        state.since = now;
        setLive((old) => (old.fps === fps && old.hands === handsInView ? old : { hands: handsInView, fps }));
      }
    },
    [trigger, updatePads],
  );

  // ---------- camera ----------

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const state = track.current;
    state.hands = [];
    state.bursts = [];
    state.lastVideoTime = -1;
    state.pinch = { left: createPinchState(), right: createPinchState() };
    for (const side of SIDES) updatePads(side, null, settingsRef.current.reach);
    const canvas = canvasRef.current;
    canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [updatePads]);

  // On leaving the page, or when the code is edited and hot-reloads, turn the
  // camera off and show the Start button again.
  useEffect(
    () => () => {
      stopCamera();
      setCamera({ state: "off", error: "" });
      setLive({ hands: 0, fps: 0 });
    },
    [stopCamera],
  );

  async function startCamera(id = deviceId) {
    boardRef.current?.unlock();
    setCamera({ state: "starting", error: "" });
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(id ? { deviceId: { exact: id } } : { facingMode: "user" }),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setDevices(cameras);
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId || id);
      setCamera({ state: "on", error: "" });
      requestAnimationFrame(resizeCanvas);
      rafRef.current = requestAnimationFrame(step);
    } catch (error) {
      stopCamera();
      setCamera({ state: "error", error: cameraErrorText(error) });
    }
  }

  function turnOff() {
    stopCamera();
    setCamera({ state: "off", error: "" });
    setLive({ hands: 0, fps: 0 });
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  }

  // ---------- page ----------

  let status = { kind: "wait", text: "Loading the hand model…" };
  if (notice) status = { kind: "warn", text: notice };
  else if (model.state === "error") status = { kind: "warn", text: `The hand model didn't load: ${model.detail}` };
  else if (camera.state === "on" && model.state === "loading") status = { kind: "wait", text: "Camera on. Loading the hand model…" };
  else if (camera.state === "on") {
    const handsText = live.hands === 0 ? "No hands in view" : live.hands === 1 ? "1 hand" : "2 hands";
    status = { kind: live.hands ? "live" : "idle", text: `${handsText} · ${live.fps} fps` };
  } else if (model.state === "ready") status = { kind: "idle", text: `Ready (${model.detail})` };

  return (
    <main className="app">
      <header className="top">
        <div>
          <h1>Finger Sounds</h1>
          <p className="lede">Touch your thumb to a fingertip to play that finger’s sound. Each hand has four.</p>
        </div>
        <p className={`status status-${status.kind}`} role="status">
          {status.text}
        </p>
      </header>

      <section ref={wrapRef} className="stage-wrap" style={{ "--ar": aspect }} aria-label="Camera">
        <div className={`stage${settings.showCamera ? "" : " no-camera"}`}>
          <video ref={videoRef} className={settings.mirror ? "mirrored" : ""} playsInline muted />
          <canvas ref={canvasRef} />
          {camera.state !== "on" && (
            <div className="stage-cover">
              <button type="button" className="primary big" onClick={() => startCamera()} disabled={camera.state === "starting"}>
                {camera.state === "starting" ? "Starting…" : "Start camera"}
              </button>
              <p className={camera.error ? "error" : ""}>
                {camera.error || "The camera picture and the hand tracking stay in this browser. Nothing is recorded or sent."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="controls" aria-label="Settings">
        {camera.state === "on" && (
          <button type="button" onClick={turnOff}>
            Stop camera
          </button>
        )}
        {devices.length > 1 && (
          <label className="field">
            <span>Camera</span>
            <select
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                startCamera(e.target.value);
              }}
            >
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field" title="How close thumb and fingertip must get, as a share of the hand's size. Higher plays sooner.">
          <span>Reach</span>
          <input type="range" min="0.15" max="0.5" step="0.01" value={settings.reach} onChange={(e) => set("reach", Number(e.target.value))} />
          <output>{Math.round(settings.reach * 100)}%</output>
        </label>
        <label className="field">
          <span>Volume</span>
          <input type="range" min="0" max="1" step="0.01" value={settings.volume} onChange={(e) => set("volume", Number(e.target.value))} />
          <output>{Math.round(settings.volume * 100)}</output>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.showCamera} onChange={(e) => set("showCamera", e.target.checked)} />
          Show camera picture
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.mirror} onChange={(e) => set("mirror", e.target.checked)} />
          Mirror
        </label>
        <label className="check" title="If your right hand shows as LEFT, turn this on.">
          <input
            type="checkbox"
            checked={settings.swapHands}
            onChange={(e) => {
              track.current.pinch = { left: createPinchState(), right: createPinchState() };
              set("swapHands", e.target.checked);
            }}
          />
          Swap hands
        </label>
        <button type="button" onClick={toggleFullscreen}>
          Full screen
        </button>
      </section>

      {loop && (
        <LoopPanel
          looper={looperRef.current}
          loop={loop}
          pads={pads}
          label={(key) => boardRef.current?.label(key) ?? key}
          onPreview={(key) => boardRef.current?.play(boardRef.current.buffer(key))}
        />
      )}

      <section className="hands">
        {SIDES.map((side) => (
          <div className="hand" key={side}>
            <h2>{side === "left" ? "Left hand" : "Right hand"}</h2>
            <div className="pads">
              {pads
                .filter((pad) => pad.hand === side)
                .map((pad) => (
                  <Pad
                    key={pad.id}
                    pad={pad}
                    files={files}
                    register={(el) => {
                      if (el) padEls.current.set(pad.id, el);
                      else padEls.current.delete(pad.id);
                    }}
                    onPlay={() => {
                      boardRef.current?.unlock();
                      trigger(pad);
                    }}
                    onSound={(sound) => chooseSound(pad, sound)}
                    onFile={(file) => loadFile(pad, file)}
                  />
                ))}
            </div>
          </div>
        ))}
      </section>

      <footer className="foot">
        <p>
          Keys <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> and <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>;</kbd> play the pads
          too. To use your own sound, drop an audio file on a pad or press Load file; it stays until you reload the page. The loop
          stays in this browser across reloads (except loaded files).
        </p>
      </footer>
    </main>
  );
}

function Pad({ pad, files, register, onPlay, onSound, onFile }) {
  const finger = FINGERS[pad.finger];
  const [over, setOver] = useState(false);
  return (
    <div
      ref={register}
      className={`pad${over ? " drop" : ""}`}
      style={{ "--c": finger.color }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
    >
      <button type="button" className="pad-hit" onClick={onPlay} aria-label={`Play ${pad.hand} ${finger.label.toLowerCase()} finger`}>
        <span className="pad-finger">{finger.label}</span>
        <kbd>{pad.key.toUpperCase()}</kbd>
        <span className="pad-meter" aria-hidden="true">
          <i />
        </span>
      </button>
      <div className="pad-tools">
        <select value={pad.sound} onChange={(e) => onSound(e.target.value)} aria-label={`${finger.label} finger sound`}>
          {SOUND_IDS.map((id) => (
            <option key={id} value={id}>
              {SOUNDS[id].label}
            </option>
          ))}
          {files.map((f) => (
            <option key={f.key} value={f.key}>
              {f.name}
            </option>
          ))}
        </select>
        <label className="load">
          Load file
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
