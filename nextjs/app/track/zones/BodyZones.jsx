"use client";

// /track/zones: step into a part of the room and its sound plays. MediaPipe Pose finds up to four people; each one's
// middle (shoulders and hips) decides which column they're in. The columns and their cues are in ../cues.js
// (`bodyZones`, the file to change); the zone logic is lib/cv/zones.js, after Marlon's /live-score Zones (launch).

import { useRef, useState } from "react";
import Link from "next/link";
import { useCamera } from "../../../lib/cv/useCamera.js";
import { useDetector } from "../../../lib/cv/useDetector.js";
import { clear, label, POSE_CONNECTIONS, skeleton, view } from "../../../lib/cv/draw.js";
import { bodyCentre, createZoneTracker } from "../../../lib/cv/zones.js";
import { fireCue } from "../../../lib/cv/stage.js";
import Stage from "../../../lib/stage/Stage.jsx";
import StageBar from "../../../lib/stage/StageBar.jsx";
import { CameraBar, CueLog, Readout, Status, fmt, useCueLog } from "../../../lib/cv/ui.jsx";
import { bodyZones } from "../cues.js";

const COLORS = ["#ff6b57", "#7fc787", "#7fb3ff", "#f2c14e", "#c88bff", "#4fd1c5"];

export default function BodyZones() {
  const camera = useCamera({ storageKey: "cv-camera-zones" });
  const canvasRef = useRef(null);
  const trackerRef = useRef({ count: 0, step: null });
  const [mirror, setMirror] = useState(true);
  const [rows, setRows] = useState([]);
  const [log, addLog] = useCueLog();
  const lastRows = useRef(0);
  // Sound: Chrome plays nothing until you click something on the page, and walking into a zone isn't a click. This
  // button is that click: it also undoes "sound off here" on the preview below and plays a test ping.
  const [soundOn, setSoundOn] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const turnOnSound = () => {
    try { localStorage.setItem("tdm155ai-sound-here", "auto"); } catch {}
    setPreviewKey((k) => k + 1); // the preview reads that setting when it starts
    setSoundOn(true);
    setTimeout(() => fireCue({ id: "zones-test", label: "Test sound", kind: "sound", src: "/samples/ping.mp3" }), 300);
  };

  const { state, fps } = useDetector(camera.videoRef, "people", (result, video) => {
    const ctx = clear(canvasRef.current, video);
    if (!ctx) return;
    const n = bodyZones.length;
    if (trackerRef.current.count !== n) trackerRef.current = { count: n, step: createZoneTracker({ zones: n }) };

    const bodies = (result.landmarks || []).map((points) => view(points, mirror));
    const centres = bodies.map(bodyCentre);
    const { people, occupied, entered } = trackerRef.current.step(centres.map((c) => c.x));
    for (const z of entered) { fireCue(bodyZones[z].cue); addLog(bodyZones[z].cue, `someone stepped into ${bodyZones[z].name}`); }

    // The columns: lit while someone is in them.
    const { width: W, height: H } = ctx.canvas;
    bodyZones.forEach((z, i) => {
      const color = COLORS[i % COLORS.length];
      ctx.globalAlpha = occupied[i] ? 0.35 : 0.06;
      ctx.fillStyle = color;
      ctx.fillRect((i / n) * W, 0, W / n, H);
      ctx.globalAlpha = 1;
      if (i) { ctx.strokeStyle = "rgba(236,236,230,.6)"; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo((i / n) * W, 0); ctx.lineTo((i / n) * W, H); ctx.stroke(); ctx.setLineDash([]); }
      label(ctx, `${i + 1} · ${z.name}${occupied[i] ? ` (${occupied[i]})` : ""}`, (i / n) * W + 16, 44, { color: occupied[i] ? "#ffffff" : "#ecece6" });
    });
    // The people: skeleton, and a dot at the point that decides their zone.
    bodies.forEach((points, i) => {
      const color = COLORS[(people[i]?.zone ?? 0) % COLORS.length];
      skeleton(ctx, points, POSE_CONNECTIONS, { color });
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(centres[i].x * W, centres[i].y * H, 18, 0, Math.PI * 2); ctx.fill();
      label(ctx, `person ${people[i]?.id} · x ${fmt(centres[i].x)}`, centres[i].x * W + 24, centres[i].y * H + 8, { size: 22 });
    });

    const now = performance.now();
    if (now - lastRows.current > 100) {
      lastRows.current = now;
      setRows([
        ["people seen", String(people.length)],
        ...people.map((p) => [`person ${p.id}`, `x ${fmt(p.x)} · ${bodyZones[p.zone]?.name}`]),
        ...bodyZones.map((z, i) => [z.name, occupied[i] ? `${occupied[i]} in` : "empty", occupied[i] > 0]),
      ]);
    }
  });

  return (
    <div className="cv-page">
      <div className="cv-head">
        <p className="eyebrow">Track · Body zones</p>
        <h1>Step into a zone, play its sound.</h1>
        <p className="cv-lede">MediaPipe Pose finds up to four people. The room is split into columns; walk into one and its sound plays once, and it plays again when someone new comes in. Step back so the camera sees your shoulders and hips. Change the columns and sounds in <code>app/track/cues.js</code> (<code>bodyZones</code>). Hands instead of bodies: <Link href="/track">/track</Link>.</p>
      </div>
      <div className="zones-sound">
        <button type="button" className={soundOn ? "is-on" : ""} onClick={turnOnSound}>{soundOn ? "🔊 Sound on (play the test again)" : "🔇 Turn on sound"}</button>
        <StageBar />
      </div>
      <CameraBar camera={camera} mirror={mirror} setMirror={setMirror} />
      <Status items={[camera.status, state, fps ? { tone: "muted", text: `${fps} fps` } : null]} />
      <div className="cv-grid">
        <div className={`cv-stagebox ${mirror ? "is-mirrored" : ""}`}>
          <video ref={camera.attach} autoPlay playsInline muted />
          <canvas ref={canvasRef} />
        </div>
        <aside className="cv-side">
          <p className="eyebrow">What the model sees</p>
          <Readout rows={rows} />
          <div>
            <p className="eyebrow">Stage preview</p>
            <Stage preview key={previewKey} />
          </div>
          <CueLog log={log} />
        </aside>
      </div>
    </div>
  );
}
