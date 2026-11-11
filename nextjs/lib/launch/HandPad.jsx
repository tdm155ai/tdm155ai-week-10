"use client";

import { useRef, useState } from "react";
import { useCamera } from "../cv/useCamera.js";
import { useDetector } from "../cv/useDetector.js";

// The XY pad, played with your hands: the camera (mirrored, like a mirror) is the pad, MediaPipe finds your hands, and
// the middle of your palm is the finger on the pad. A hand in view (or a pinch, if you choose) is "touching"; take it
// away and the effects spring back. With "both", your left hand plays the filter and your right hand the echo.
// Uses CV's camera and MediaPipe helpers (lib/cv/useCamera.js, lib/cv/useDetector.js).

const PALM = [0, 5, 9, 13, 17]; // wrist and the four knuckles: their middle is steadier than a fingertip
const EDGE = 0.1; // hands rarely reach the very edge of the picture, so the pad's edges are 10% in
const SMOOTH = 0.55; // 0 = frozen, 1 = raw (jittery); in between follows the hand closely without shaking

const clamp = (v) => Math.max(0, Math.min(1, v));
const toPad = (v) => clamp((v - EDGE) / (1 - 2 * EDGE));

export default function HandPad({ modes, mode, send, rest, hold }) {
  const camera = useCamera({ storageKey: "xy-camera", width: 960, height: 540 });
  const [hands, setHands] = useState("any");
  const [grab, setGrab] = useState("view");
  const [seen, setSeen] = useState("");
  const canvasRef = useRef(null);
  const smooth = useRef({}); // role -> { x, y }
  const active = useRef({}); // role -> touching last frame?
  const settingsRef = useRef({});
  settingsRef.current = { hands, grab, mode, hold };

  const { state, fps } = useDetector(camera.videoRef, "hand", (result) => {
    const { hands: which, grab: how, mode: m, hold: keep } = settingsRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; ctx.clearRect(0, 0, canvas.width, canvas.height); }

    // Each hand as seen on screen (mirrored): x from the left, y from the top.
    const found = (result.landmarks || []).map((points) => {
      const sx = PALM.reduce((s, i) => s + (1 - points[i].x), 0) / PALM.length;
      const sy = PALM.reduce((s, i) => s + points[i].y, 0) / PALM.length;
      const size = Math.hypot(points[0].x - points[9].x, points[0].y - points[9].y) || 0.1;
      const pinched = Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y) / size < 0.35;
      return { sx, sy, pinched, points };
    }).sort((a, b) => a.sx - b.sx); // left of the screen first

    // Which hand plays what: with two hands, the one on the left of the screen is your left hand.
    const roles = {};
    if (which === "both") {
      if (found.length >= 2) { roles.left = found[0]; roles.right = found[found.length - 1]; }
      else if (found.length === 1) roles[found[0].sx < 0.5 ? "left" : "right"] = found[0];
    } else if (which === "left") { if (found.length) roles.pad = found[0]; }
    else if (which === "right") { if (found.length) roles.pad = found[found.length - 1]; }
    else if (found.length) roles.pad = found[0];

    const axes = { pad: modes[m], left: modes.filter, right: modes.echo };
    for (const role of ["pad", "left", "right"]) {
      const hand = roles[role];
      const a = axes[role];
      const touching = !!hand && (how === "view" || hand.pinched);
      if (touching) {
        const target = { x: toPad(hand.sx), y: 1 - toPad(hand.sy) };
        const prev = active.current[role] ? smooth.current[role] : target;
        const s = { x: prev.x + (target.x - prev.x) * SMOOTH, y: prev.y + (target.y - prev.y) * SMOOTH };
        smooth.current[role] = s;
        send(a.x, s.x); send(a.y, s.y);
      } else if (active.current[role] && !keep) {
        send(a.x, rest[a.x]); send(a.y, rest[a.y]); // let go: spring back
      }
      active.current[role] = touching;
      if (hand && ctx) {
        ctx.fillStyle = touching ? "#ff5a36" : "rgba(255,255,255,.5)";
        for (const p of hand.points) { ctx.beginPath(); ctx.arc((1 - p.x) * canvas.width, p.y * canvas.height, 3, 0, 7); ctx.fill(); }
        ctx.beginPath(); ctx.arc(hand.sx * canvas.width, hand.sy * canvas.height, touching ? 16 : 10, 0, 7); ctx.fill();
        if (role !== "pad") { ctx.font = "600 14px system-ui"; ctx.fillText(role === "left" ? "filter" : "echo", hand.sx * canvas.width + 20, hand.sy * canvas.height); }
      }
    }
    const text = found.length ? `${found.length} hand${found.length > 1 ? "s" : ""}` : "no hands";
    if (text !== seen) setSeen(text);
  });

  return (
    <div>
      <div className="ctl-row xy-modes">
        <label className="ctl-note">Hands{" "}
          <select className="ctl-select" value={hands} onChange={(e) => setHands(e.target.value)}>
            <option value="any">any hand plays the pad</option>
            <option value="left">left hand only</option>
            <option value="right">right hand only</option>
            <option value="both">both: left = filter, right = echo</option>
          </select>
        </label>
        <label className="ctl-note">Touch{" "}
          <select className="ctl-select" value={grab} onChange={(e) => setGrab(e.target.value)}>
            <option value="view">a hand in view</option>
            <option value="pinch">pinch (thumb to finger)</option>
          </select>
        </label>
        {camera.cameras.length > 1 && (
          <select className="ctl-select" value={camera.cameraId} onChange={(e) => camera.chooseCamera(e.target.value)}>
            {camera.cameras.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}
          </select>
        )}
      </div>
      <div className="xy-pad xy-camera">
        <video ref={camera.attach} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
        <div className="xy-center" />
        <span className="xy-label">{hands === "both" ? "left hand: ← low-pass · high-pass →, up = resonance · right hand: ← short · long echo →, up = more" : modes[mode].hint}</span>
      </div>
      <p className="ctl-note">{camera.status.tone === "error" ? camera.status.text : `${state.text || camera.status.text} ${fps ? `${fps} fps · ` : ""}${seen}`}</p>
    </div>
  );
}
