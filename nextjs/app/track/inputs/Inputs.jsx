"use client";

// /track/inputs: what the camera models see, as numbers. Pick hand, head, or body; the camera opens only when you press
// Start, and only one model runs at a time. Uses the same pieces as the other /track pages (lib/cv/).

import { useRef, useState } from "react";
import Link from "next/link";
import { useCamera } from "../../../lib/cv/useCamera.js";
import { useDetector } from "../../../lib/cv/useDetector.js";
import { clear, dots, HAND_CONNECTIONS, label, POSE_CONNECTIONS, skeleton, view } from "../../../lib/cv/draw.js";
import { bodyCentre, zoneOf } from "../../../lib/cv/zones.js";
import { CameraBar, Readout, Status, fmt } from "../../../lib/cv/ui.jsx";

const KINDS = {
  hand: { label: "Hand", model: "hand", says: "21 points per hand: fingertip x/y, pinch, zone" },
  head: { label: "Head", model: "face", says: "478 face points: nose x/y, mouth open, blink, zone" },
  body: { label: "Body", model: "pose", says: "33 body points: centre x/y, wrists up, zone" },
};
const ZONES = ["left", "middle", "right"];

export default function Inputs() {
  const [kind, setKind] = useState("hand");
  const [on, setOn] = useState(false);
  return (
    <div className="cv-page">
      <div className="cv-head">
        <p className="eyebrow">Track · Inputs</p>
        <h1>What the camera sees.</h1>
        <p className="cv-lede">Pick one, press Start, and watch the numbers. Boxes: <Link href="/draw-a-box/hello">/draw-a-box/hello</Link>.</p>
      </div>
      <div className="cv-tabs" role="group" aria-label="Input">
        {Object.entries(KINDS).map(([key, k]) => (
          <button key={key} type="button" aria-pressed={key === kind} onClick={() => setKind(key)}>{k.label}</button>
        ))}
        {!on && <button type="button" aria-pressed="true" onClick={() => setOn(true)}>Start camera</button>}
        {on && <button type="button" onClick={() => setOn(false)}>Stop camera</button>}
      </div>
      <p className="cv-explain">{KINDS[kind].says}</p>
      {on ? <Diagnostic kind={kind} /> : <p className="cv-muted">The camera is off.</p>}
    </div>
  );
}

function Diagnostic({ kind }) {
  const camera = useCamera({ storageKey: "cv-camera-track" });
  const canvasRef = useRef(null);
  const [mirror, setMirror] = useState(true);
  const [rows, setRows] = useState([]);
  const lastRows = useRef(0);

  const { state, fps } = useDetector(camera.videoRef, KINDS[kind].model, (result, video) => {
    const ctx = clear(canvasRef.current, video);
    if (!ctx) return;
    const { width: W, height: H } = ctx.canvas;
    // The three zones, as thin lines.
    ctx.strokeStyle = "rgba(236,236,230,.35)"; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
    [1, 2].forEach((i) => { ctx.beginPath(); ctx.moveTo((i / 3) * W, 0); ctx.lineTo((i / 3) * W, H); ctx.stroke(); });
    ctx.setLineDash([]);

    let out = [];
    if (kind === "hand") {
      const hands = (result.landmarks || []).map((p) => view(p, mirror));
      out.push(["hands", String(hands.length)]);
      hands.forEach((p, i) => {
        skeleton(ctx, p, HAND_CONNECTIONS);
        const tip = p[8];
        const pinch = Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) / Math.max(Math.hypot(p[0].x - p[9].x, p[0].y - p[9].y), 1e-6);
        label(ctx, `${i + 1}`, tip.x * W + 12, tip.y * H - 12);
        out.push([`hand ${i + 1} fingertip`, `x ${fmt(tip.x)} · y ${fmt(tip.y)}`], [`hand ${i + 1} pinch`, `${fmt(pinch)} ${pinch < 0.25 ? "PINCH" : ""}`, pinch < 0.25], [`hand ${i + 1} zone`, ZONES[zoneOf(tip.x, 3)]]);
      });
    } else if (kind === "head") {
      const face = result.faceLandmarks?.[0] ? view(result.faceLandmarks[0], mirror) : null;
      const shapes = Object.fromEntries((result.faceBlendshapes?.[0]?.categories || []).map((c) => [c.categoryName, c.score]));
      out.push(["face", face ? "yes" : "no"]);
      if (face) {
        dots(ctx, face, { every: 2, radius: 2 });
        const nose = face[1];
        ctx.fillStyle = "#ff6b57"; ctx.beginPath(); ctx.arc(nose.x * W, nose.y * H, 10, 0, Math.PI * 2); ctx.fill();
        out.push(["nose", `x ${fmt(nose.x)} · y ${fmt(nose.y)}`], ["mouth open (jawOpen)", fmt(shapes.jawOpen), (shapes.jawOpen ?? 0) > 0.45], ["blink", `${fmt(shapes.eyeBlinkLeft)} · ${fmt(shapes.eyeBlinkRight)}`], ["smile", fmt(((shapes.mouthSmileLeft ?? 0) + (shapes.mouthSmileRight ?? 0)) / 2)], ["zone", ZONES[zoneOf(nose.x, 3)]]);
      }
    } else {
      const body = result.landmarks?.[0] ? view(result.landmarks[0], mirror) : null;
      out.push(["body", body ? "yes" : "no"]);
      if (body) {
        skeleton(ctx, body, POSE_CONNECTIONS, { color: "#7fb3ff" });
        const c = bodyCentre(body);
        ctx.fillStyle = "#7fb3ff"; ctx.beginPath(); ctx.arc(c.x * W, c.y * H, 14, 0, Math.PI * 2); ctx.fill();
        const up = (w) => body[0].y - body[w].y > 0 && (body[w].visibility ?? 1) > 0.5;
        out.push(["centre", `x ${fmt(c.x)} · y ${fmt(c.y)}`], ["left wrist up", up(15) ? "yes" : "no", up(15)], ["right wrist up", up(16) ? "yes" : "no", up(16)], ["zone", ZONES[zoneOf(c.x, 3)]]);
      }
    }
    const now = performance.now();
    if (now - lastRows.current > 100) { lastRows.current = now; setRows(out); }
  });

  return (
    <>
      <CameraBar camera={camera} mirror={mirror} setMirror={setMirror} />
      <Status items={[camera.status, state, fps ? { tone: "muted", text: `${fps} fps` } : null]} />
      <div className="cv-grid">
        <div className={`cv-stagebox ${mirror ? "is-mirrored" : ""}`}>
          <video ref={camera.attach} autoPlay playsInline muted />
          <canvas ref={canvasRef} />
        </div>
        <aside className="cv-side">
          <p className="eyebrow">The numbers</p>
          <Readout rows={rows} />
        </aside>
      </div>
    </>
  );
}
