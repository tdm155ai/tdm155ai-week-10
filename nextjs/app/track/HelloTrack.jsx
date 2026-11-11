"use client";

// /track, Hello World: MediaPipe finds your hands; an index fingertip inside a zone fires that zone's cue on the stage.
// The zones and cues are in ./cues.js (the file to change). This file is the machinery.

import { useRef, useState } from "react";
import Link from "next/link";
import { useCamera } from "../../lib/cv/useCamera.js";
import { useDetector } from "../../lib/cv/useDetector.js";
import { clear, HAND_CONNECTIONS, label, skeleton, view, zone } from "../../lib/cv/draw.js";
import { makeTriggers } from "../../lib/cv/trigger.js";
import { fireCue } from "../../lib/cv/stage.js";
import Stage from "../../lib/stage/Stage.jsx";
import { CameraBar, CueLog, Readout, Status, fmt, useCueLog } from "../../lib/cv/ui.jsx";
import { zones } from "./cues.js";

const INDEX_TIP = 8;

export default function HelloTrack() {
  const camera = useCamera({ storageKey: "cv-camera-track" });
  const canvasRef = useRef(null);
  const triggersRef = useRef(makeTriggers({ holdMs: 120, rearmMs: 400 }));
  const [mirror, setMirror] = useState(true);
  const [rows, setRows] = useState([]);
  const [log, addLog] = useCueLog();
  const lastRows = useRef(0);

  const { state, fps } = useDetector(camera.videoRef, "hand", (result, video) => {
    const ctx = clear(canvasRef.current, video);
    if (!ctx) return;
    const hands = (result.landmarks || []).map((points) => view(points, mirror));
    const tips = hands.map((points) => points[INDEX_TIP]);

    const inside = zones.map((z) => tips.some((tip) => tip.x >= z.x && tip.x <= z.x + z.w && tip.y >= z.y && tip.y <= z.y + z.h));
    zones.forEach((z, i) => {
      const { fired } = triggersRef.current(z.name, inside[i]);
      if (fired) { fireCue(z.cue); addLog(z.cue, z.name); }
      zone(ctx, z, inside[i]);
    });
    hands.forEach((points, i) => {
      skeleton(ctx, points, HAND_CONNECTIONS);
      const tip = points[INDEX_TIP];
      label(ctx, `hand ${i + 1}: x ${fmt(tip.x)}  y ${fmt(tip.y)}`, tip.x * ctx.canvas.width + 14, tip.y * ctx.canvas.height - 14, { size: 22 });
    });

    const now = performance.now();
    if (now - lastRows.current > 100) {
      lastRows.current = now;
      setRows([
        ["hands seen", String(hands.length)],
        ...tips.map((tip, i) => [`hand ${i + 1} fingertip`, `x ${fmt(tip.x)} · y ${fmt(tip.y)}`]),
        ...zones.map((z, i) => [z.name, inside[i] ? "IN" : "out", inside[i]]),
      ]);
    }
  });

  return (
    <div className="cv-page">
      <div className="cv-head">
        <div>
          <p className="eyebrow">Track · Hello World</p>
          <h1>Raise a hand, fire a cue.</h1>
          <p className="cv-lede">MediaPipe finds 21 points on each hand. Put your index fingertip in a zone and its cue fires on the stage, once; take your hand out to re-arm. Change the zones and cues in <code>app/track/cues.js</code>. Next: <Link href="/track/instruments">instruments</Link> (fader, pinch, gestures, mouth, arms up). How-to: <Link href="/docs/track">docs/track</Link>.</p>
        </div>
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
            <p className="eyebrow">Stage preview (silent)</p>
            <Stage preview />
          </div>
          <CueLog log={log} />
        </aside>
      </div>
    </div>
  );
}
