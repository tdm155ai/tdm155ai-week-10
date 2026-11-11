"use client";

// /track/instruments: five small MediaPipe instruments. Their logic is in lib/cv/instruments.js;
// what they fire is in app/track/cues.js (the file to change).

import { useRef, useState } from "react";
import Link from "next/link";
import { useCamera } from "../../../lib/cv/useCamera.js";
import { useDetector } from "../../../lib/cv/useDetector.js";
import { clear } from "../../../lib/cv/draw.js";
import { INSTRUMENTS } from "../../../lib/cv/instruments.js";
import { makeThrottle, makeTriggers } from "../../../lib/cv/trigger.js";
import { fireCue, setParam } from "../../../lib/cv/stage.js";
import Stage from "../../../lib/stage/Stage.jsx";
import { CameraBar, CueLog, Readout, Status, useCueLog } from "../../../lib/cv/ui.jsx";
import { instruments as config } from "../cues.js";

// Which cue an instrument's switch fires: gestures map each gesture name; the others have one cue.
function cueFor(name, key) {
  if (name === "gestures") return config.gestures?.[key];
  return config[name]?.cue;
}

export default function Instruments() {
  const camera = useCamera({ storageKey: "cv-camera-track" });
  const canvasRef = useRef(null);
  const [name, setName] = useState("fader");
  const [mirror, setMirror] = useState(true);
  const [rows, setRows] = useState([]);
  const [fader, setFader] = useState(null);
  const [log, addLog] = useCueLog();
  const triggersRef = useRef(makeTriggers({ holdMs: 200, rearmMs: 500 }));
  const throttleRef = useRef(makeThrottle());
  const scrubRef = useRef({ at: 0, value: -1 });
  const lastRows = useRef(0);
  const instrument = INSTRUMENTS[name];

  // The video instrument needs a video on the stage: put its clip up when it's picked (and on the button).
  function startVideo() {
    if (!config.video?.cue) return;
    fireCue(config.video.cue);
    addLog(config.video.cue, "Scrub a video: clip on the stage");
  }

  const { state, fps } = useDetector(camera.videoRef, instrument.model, (result, video) => {
    const ctx = clear(canvasRef.current, video);
    if (!ctx) return;
    const out = instrument.read(result, mirror, ctx, config[name]);

    for (const [key, active] of Object.entries(out.on)) {
      const { fired } = triggersRef.current(`${name}:${key}`, active);
      if (name === "video") { if (fired) setParam("play", 1); continue; } // a pinch lets the video play
      const cue = cueFor(name, key);
      if (fired && cue) { fireCue(cue); addLog(cue, `${instrument.label}: ${key}`); }
    }
    // Gestures that vanished this frame still need their "off" so they re-arm.
    if (name === "gestures") for (const key of Object.keys(config.gestures || {})) if (!out.on[key]) triggersRef.current(`${name}:${key}`, false);

    if (name === "fader" && out.value !== null && throttleRef.current(out.value)) setParam(config.fader?.param || "brightness", out.value);
    if (name === "video" && out.scrub != null) {
      // Send the position when it moves, and again every 0.4 s when it doesn't (a stage still loading the clip misses the first).
      const last = scrubRef.current;
      const now = performance.now();
      if (now - last.at > 80 && (Math.abs(out.scrub - last.value) >= 0.005 || now - last.at > 400)) { last.at = now; last.value = out.scrub; setParam("scrub", out.scrub); }
    }

    const now = performance.now();
    if (now - lastRows.current > 100) { lastRows.current = now; setRows(out.readout); if (name === "fader") setFader(out.value); }
  });

  return (
    <div className="cv-page">
      <div className="cv-head">
        <p className="eyebrow">Track · Instruments</p>
        <h1>Your body is the controller.</h1>
        <p className="cv-lede">Six small instruments made with MediaPipe. Each shows the numbers the model sees and fires a cue once per gesture. Change what they fire in <code>app/track/cues.js</code>; change how they work in <code>lib/cv/instruments.js</code>. Start at <Link href="/track">Hello World</Link>; how-to in <Link href="/docs/track">docs/track</Link>.</p>
      </div>
      <div className="cv-tabs" role="group" aria-label="Instrument">
        {Object.entries(INSTRUMENTS).map(([key, item]) => (
          <button key={key} type="button" aria-pressed={key === name} onClick={() => { setName(key); setRows([]); if (key === "video") startVideo(); }}>{item.label}</button>
        ))}
      </div>
      <p className="cv-explain">{instrument.explain}</p>
      <CameraBar camera={camera} mirror={mirror} setMirror={setMirror}>
        {name === "video" && <button type="button" className="cv-quiet" onClick={startVideo}>Put the clip on the stage</button>}
      </CameraBar>
      <Status items={[camera.status, state, fps ? { tone: "muted", text: `${fps} fps` } : null]} />
      <div className="cv-grid">
        <div className={`cv-stagebox ${mirror ? "is-mirrored" : ""}`}>
          <video ref={camera.attach} autoPlay playsInline muted />
          <canvas ref={canvasRef} />
        </div>
        <aside className="cv-side">
          <p className="eyebrow">What the model sees</p>
          <Readout rows={rows} />
          {name === "fader" && (
            <div>
              <p className="eyebrow">Stage {config.fader?.param || "brightness"}</p>
              <div className="cv-meter"><span style={{ width: `${Math.round((fader ?? 0) * 100)}%` }} /></div>
            </div>
          )}
          <div>
            <p className="eyebrow">Stage preview (silent)</p>
            <Stage preview />
          </div>
          <CueLog log={log} />
        </aside>
      </div>
    </div>
  );
}
