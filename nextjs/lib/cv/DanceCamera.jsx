"use client";

// A camera shot with words stuck to your forehead: a pink "Dance!!" that flashes slowly while the music plays, and,
// when the music stops, a black "STOP" that holds for three seconds and then fades. Used by /voice/shaders.
//
//   <DanceCamera active={cameraOn} playing={musicPlaying} stopToken={stops} />
//
// `active`: false renders nothing and opens no camera, so set it true from a click (the browser asks for the camera then).
// `playing`: true shows "Dance!!". `stopToken`: add 1 each time the music stops; every change shows "STOP".
// It fills its parent (give the parent a size and position: relative). The picture is mirrored, like a mirror.
// Nothing is recorded or stored: frames go from the camera to MediaPipe's face model in this tab and nowhere else.
// The page that uses it owns the sound, the words and the layout; this owns the camera and the text on the face.

import { useEffect, useRef, useState } from "react";
import { useCamera } from "./useCamera.js";
import { useDetector } from "./useDetector.js";

// Face landmarks (MediaPipe's 478-point face mesh): 10 = top of the forehead, 151 = middle of the forehead,
// 234 and 454 = the sides of the face (for size), 33 and 263 = the outer eye corners (for head tilt).
const TOP = 10, MID = 151, LEFT = 234, RIGHT = 454, EYE_A = 33, EYE_B = 263;
const SMOOTH = 0.35; // 0 = frozen, 1 = no smoothing: how far the text moves toward the face each frame
const LOST_MS = 600; // hide the text when the face has been gone this long

const CSS = `
.dance-cam { position: absolute; inset: 0; overflow: hidden; background: #000; }
.dance-cam video { position: absolute; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); }
.dance-cam-anchor { position: absolute; left: 0; top: 0; transition: opacity .3s; will-change: transform; pointer-events: none; }
.dance-cam-word { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); white-space: nowrap; font-weight: 900; line-height: 1; letter-spacing: .02em; }
.dance-cam-dance { animation: dance-cam-flash 1.2s ease-in-out infinite; text-shadow: 0 0 .12em rgba(0, 0, 0, .55); }
.dance-cam-stop { font-size: 1.25em; text-shadow: 0 0 .12em rgba(255, 255, 255, .85); }
.dance-cam-status { position: absolute; left: 12px; bottom: 10px; margin: 0; font-size: 13px; color: #fff; text-shadow: 0 1px 2px #000; }
@keyframes dance-cam-flash { 0%, 100% { opacity: 1; } 50% { opacity: .2; } }
`;

export default function DanceCamera({ active = false, ...props }) {
  return active ? <Feed {...props} /> : null;
}

function Feed({ playing = false, stopToken = 0, danceText = "Dance!!", stopText = "STOP", danceColor = "#ff2d95", stopColor = "#000000", stopHoldMs = 3000, fadeMs = 1000, fit = "cover", showStatus = true, onStatus }) {
  const camera = useCamera({ storageKey: "cv-camera-track" });
  const boxRef = useRef(null);
  const anchorRef = useRef(null);
  const smooth = useRef(null); // { x, y, size, angle } in pixels and radians
  const lastSeen = useRef(0);

  // "STOP": null (not showing), "hold", then "fade".
  const [stopPhase, setStopPhase] = useState(null);
  const lastToken = useRef(stopToken);
  useEffect(() => {
    if (stopToken === lastToken.current) return undefined;
    lastToken.current = stopToken;
    setStopPhase("hold");
    const fade = setTimeout(() => setStopPhase("fade"), stopHoldMs);
    const done = setTimeout(() => setStopPhase(null), stopHoldMs + fadeMs);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, [stopToken, stopHoldMs, fadeMs]);
  useEffect(() => { if (playing) setStopPhase(null); }, [playing]);

  const { state } = useDetector(camera.videoRef, "face", (result, video) => {
    const box = boxRef.current, anchor = anchorRef.current;
    if (!box || !anchor) return;
    const face = result.faceLandmarks?.[0];
    const now = performance.now();
    if (!face) {
      if (now - lastSeen.current > LOST_MS) anchor.style.opacity = "0";
      return;
    }
    lastSeen.current = now;

    // Where the video's picture sits inside the box (object-fit cover or contain), so a landmark lands on the face.
    const w = box.clientWidth, h = box.clientHeight;
    const scale = (fit === "contain" ? Math.min : Math.max)(w / video.videoWidth, h / video.videoHeight);
    const shownW = video.videoWidth * scale, shownH = video.videoHeight * scale;
    const left = (w - shownW) / 2, top = (h - shownH) / 2;
    const at = (i) => ({ x: left + (1 - face[i].x) * shownW, y: top + face[i].y * shownH }); // mirrored

    const a = at(TOP), b = at(MID);
    const target = {
      x: (a.x + b.x) / 2, // halfway between the top and the middle of the forehead, so the words sit on it
      y: (a.y + b.y) / 2,
      size: Math.hypot(at(LEFT).x - at(RIGHT).x, at(LEFT).y - at(RIGHT).y),
      angle: Math.atan2(at(EYE_A).y - at(EYE_B).y, at(EYE_A).x - at(EYE_B).x),
    };
    const s = smooth.current;
    smooth.current = s
      ? { x: s.x + (target.x - s.x) * SMOOTH, y: s.y + (target.y - s.y) * SMOOTH, size: s.size + (target.size - s.size) * SMOOTH, angle: s.angle + (target.angle - s.angle) * SMOOTH }
      : target;
    const { x, y, size, angle } = smooth.current;
    anchor.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
    anchor.style.fontSize = `${Math.max(14, size * 0.24)}px`;
    anchor.style.opacity = "1";
  });

  const status = camera.status.tone === "error" ? camera.status.text : state.text;
  useEffect(() => { onStatus?.(status); }, [status, onStatus]);

  return (
    <div className="dance-cam" ref={boxRef}>
      <style>{CSS}</style>
      <video ref={camera.attach} autoPlay playsInline muted style={{ objectFit: fit }} />
      <div className="dance-cam-anchor" ref={anchorRef} style={{ opacity: 0 }}>
        {playing && !stopPhase && <span className="dance-cam-word dance-cam-dance" style={{ color: danceColor }}>{danceText}</span>}
        {stopPhase && (
          <span className="dance-cam-word dance-cam-stop" style={{ color: stopColor, opacity: stopPhase === "fade" ? 0 : 1, transition: `opacity ${fadeMs}ms` }}>{stopText}</span>
        )}
      </div>
      {showStatus && camera.status.tone === "error" && <p className="dance-cam-status">{status}</p>}
    </div>
  );
}
