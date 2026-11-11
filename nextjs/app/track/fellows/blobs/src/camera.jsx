"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaceDetector, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { COLORS } from "./colors.js";
import { CHANNEL, EMPTY } from "./shared.js";
// In the original app this was copied from node_modules into public/ by a postinstall script. In the class app it
// comes from the CDN, at the version in package.json.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export default function Camera() {
    const videoRef = useRef(null);
    const overlayRef = useRef(null);
    const stopRef = useRef(null);
    const displayRef = useRef(null);
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("Camera is off.");
    const stop = useCallback(() => {
        stopRef.current?.();
        stopRef.current = null;
        setStatus("idle");
        setMessage("Camera is off.");
    }, []);
    useEffect(() => () => stopRef.current?.(), []);
    const start = useCallback(async () => {
        setStatus("loading");
        setMessage("Loading models…");
        let stream = null;
        let raf = 0;
        let cancelled = false;
        const channel = new BroadcastChannel(CHANNEL);
        let faceDetector = null;
        let handLandmarker = null;
        const cleanup = () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            stream?.getTracks().forEach((t) => t.stop());
            if (videoRef.current)
                videoRef.current.srcObject = null;
            faceDetector?.close();
            handLandmarker?.close();
            channel.postMessage(EMPTY);
            channel.close();
            const overlay = overlayRef.current;
            overlay?.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
        };
        stopRef.current = cleanup;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: "user" },
                audio: false,
            });
            const fileset = await FilesetResolver.forVisionTasks(WASM);
            [faceDetector, handLandmarker] = await Promise.all([
                FaceDetector.createFromOptions(fileset, {
                    baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
                    runningMode: "VIDEO",
                }),
                HandLandmarker.createFromOptions(fileset, {
                    baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
                    runningMode: "VIDEO",
                    numHands: 2,
                }),
            ]);
            if (cancelled)
                return;
            const video = videoRef.current;
            video.srcObject = stream;
            await video.play();
            setStatus("running");
            setMessage("Tracking. Open the display to see the effect.");
            let lastTime = -1;
            let frame = 0;
            let faces = [];
            const loop = () => {
                if (cancelled)
                    return;
                raf = requestAnimationFrame(loop);
                if (video.readyState < 2 || video.currentTime === lastTime)
                    return;
                lastTime = video.currentTime;
                const now = performance.now();
                // Heads move slowly: detect the face every third frame to save work for the hands.
                if (frame++ % 3 === 0)
                    faces = faceDetector.detectForVideo(video, now).detections;
                const handResult = handLandmarker.detectForVideo(video, now);
                const hands = handResult.landmarks;
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                const box = faces[0]?.boundingBox;
                // Mirror x so the display behaves like a mirror.
                const head = box
                    ? { x: 1 - (box.originX + box.width / 2) / vw, y: (box.originY + box.height / 2) / vh }
                    : null;
                // Landmark 8 is the index fingertip.
                // The camera image is unmirrored, so the model's "Left" is the viewer's right hand.
                // Fill slot 0 (viewer's left) / 1 (right); if both read the same, fall back to order.
                const slots = [null, null];
                const labels = handResult.handedness.map((h) => h[0]?.categoryName);
                hands.forEach((h, i) => {
                    const point = { x: 1 - h[8].x, y: h[8].y };
                    let slot = labels[i] === "Left" ? 1 : 0;
                    if (slots[slot])
                        slot = 1 - slot;
                    slots[slot] = point;
                });
                const msg = { head, hands: slots };
                channel.postMessage(msg);
                const overlay = overlayRef.current;
                const ctx = overlay?.getContext("2d");
                if (overlay && ctx) {
                    if (overlay.width !== vw) {
                        overlay.width = vw;
                        overlay.height = vh;
                    }
                    ctx.clearRect(0, 0, vw, vh);
                    // Markers use the display's colours. The canvas is CSS-mirrored, so draw raw (unmirrored) coordinates.
                    const marker = (x, y, color) => {
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(x * vw, y * vh, 14, 0, Math.PI * 2);
                        ctx.fill();
                    };
                    if (box)
                        marker((box.originX + box.width / 2) / vw, (box.originY + box.height / 2) / vh, COLORS.head);
                    slots.forEach((p, i) => {
                        if (p)
                            marker(1 - p.x, p.y, i === 0 ? COLORS.leftHand : COLORS.rightHand);
                    });
                }
            };
            loop();
        }
        catch (err) {
            cleanup();
            stopRef.current = null;
            setStatus("error");
            setMessage(err instanceof Error && err.name === "NotAllowedError"
                ? "Camera permission was denied."
                : `Could not start: ${err instanceof Error ? err.message : err instanceof Event ? `failed to load ${err.target?.src ?? "a script"}` : String(err)}`);
        }
    }, []);
    const openDisplay = () => {
        if (displayRef.current && !displayRef.current.closed) {
            displayRef.current.focus();
            return;
        }
        displayRef.current = window.open("/track/fellows/blobs/display", "blobs-display", "popup,width=1280,height=720");
    };
    return (<section style={{ marginTop: 40, display: "grid", gap: 20 }}>
      <div className="stage">
        <video ref={videoRef} muted playsInline/>
        <canvas ref={overlayRef}/>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {status === "running" ? (<button className="btn" onClick={stop}>Stop camera</button>) : (<button className="btn btn-primary" onClick={start} disabled={status === "loading"}>
            {status === "loading" ? "Loading…" : "Start camera"}
          </button>)}
        <button className="btn" onClick={openDisplay}>Open display window ↗</button>
      </div>
      <p className={`status${status === "error" ? " error" : ""}`} role="status">{message}</p>
    </section>);
}
