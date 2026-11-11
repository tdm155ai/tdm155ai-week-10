"use client";

// From mk-realtime-prototypes /face-paint (Marlon, Sep 25–29, 2026), copied into the class app on Nov 11: TypeScript
// types removed, imports made relative, MediaPipe at the version this app uses. Otherwise unchanged.

// How it works:
// 1. MediaPipe's Face Landmarker finds 468 points on the face in each webcam frame.
// 2. Those points always come in the same order, so they can be the vertices of a fixed
//    triangle mesh (the canonical face mesh), and every vertex has a fixed spot on a flat
//    "unwrap" of the face (its UV coordinate).
// 3. The paint pad is that unwrap. Three.js stretches it over the live mesh as a texture,
//    so paint on the pad lands on the matching spot of the face and moves with it.
// 4. To keep the paint glued to the face, each webcam frame is copied once, tracked, and
//    drawn in the same WebGL scene as the mesh. If the page showed the <video> directly, the
//    picture would run a frame or two ahead of the tracking and the paint would trail behind.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FACE_MESH_TRIANGLES, FACE_MESH_UVS, FACE_MESH_VERTEX_COUNT } from "../../../lib/cv/face-mesh-data.js";
const MEDIAPIPE_VERSION = "1.2.2"; // keep in step with @mediapipe/tasks-vision in package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const PAD_SIZE = 1024;
const SWATCHES = ["#ffffff", "#111111", "#e11d48", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
export default function FacePaint() {
    const videoRef = useRef(null);
    const stageRef = useRef(null);
    const guideRef = useRef(null);
    const paintRef = useRef(null);
    const sessionRef = useRef(null);
    const lastPoint = useRef(null);
    const showMeshRef = useRef(true);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");
    const [color, setColor] = useState(SWATCHES[2]);
    const [brush, setBrush] = useState(24);
    const [erasing, setErasing] = useState(false);
    const [showMesh, setShowMesh] = useState(true);
    const [faceFound, setFaceFound] = useState(false);
    // Draw the wireframe unwrap on the guide canvas once, so there is something to paint on.
    useEffect(() => {
        const ctx = guideRef.current?.getContext("2d");
        if (!ctx)
            return;
        ctx.fillStyle = "#18181b";
        ctx.fillRect(0, 0, PAD_SIZE, PAD_SIZE);
        drawWireframe(ctx, "rgba(255,255,255,0.18)");
    }, []);
    useEffect(() => {
        showMeshRef.current = showMesh;
    }, [showMesh]);
    // Stop the camera and free the GPU when leaving the page.
    useEffect(() => () => stop(sessionRef.current), []);
    async function start() {
        const video = videoRef.current;
        const stage = stageRef.current;
        const paint = paintRef.current;
        if (!video || !stage || !paint)
            return;
        setStatus("loading");
        const restoreConsole = quietMediaPipeInfo();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            video.srcObject = stream;
            await video.play();
            const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
            const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
            const landmarker = await FaceLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
                runningMode: "VIDEO",
                numFaces: 1,
            });
            // The stage is an orthographic view of the unit square, so a landmark at normalized (x, y)
            // lands on the same pixel as in the video underneath it.
            const renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(video.videoWidth, video.videoHeight, false);
            const scene = new THREE.Scene();
            const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
            // The webcam picture: a copy of the frame being tracked, on a plane behind the face.
            const frameCanvas = document.createElement("canvas");
            frameCanvas.width = video.videoWidth;
            frameCanvas.height = video.videoHeight;
            const frameCtx = frameCanvas.getContext("2d");
            if (!frameCtx)
                throw new Error("no 2D canvas");
            const frameTexture = new THREE.CanvasTexture(frameCanvas);
            frameTexture.colorSpace = THREE.SRGBColorSpace;
            const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: frameTexture }));
            backdrop.position.set(0.5, 0.5, -5);
            scene.add(backdrop);
            const positions = new Float32Array(FACE_MESH_VERTEX_COUNT * 3);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute("uv", new THREE.BufferAttribute(FACE_MESH_UVS, 2));
            geometry.setIndex(new THREE.BufferAttribute(FACE_MESH_TRIANGLES, 1));
            const texture = new THREE.CanvasTexture(paint);
            texture.colorSpace = THREE.SRGBColorSpace;
            const face = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
            const wireframe = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.15 }));
            scene.add(face, wireframe);
            const session = { stream, landmarker, renderer, texture, frame: 0, restoreConsole };
            sessionRef.current = session;
            let lastVideoTime = -1;
            let hadFace = false;
            const tick = () => {
                session.frame = requestAnimationFrame(tick);
                if (video.currentTime === lastVideoTime)
                    return;
                lastVideoTime = video.currentTime;
                frameCtx.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
                frameTexture.needsUpdate = true;
                const points = landmarker.detectForVideo(frameCanvas, performance.now()).faceLandmarks[0];
                const found = Boolean(points);
                if (found !== hadFace) {
                    hadFace = found;
                    setFaceFound(found);
                }
                face.visible = found;
                wireframe.visible = found && showMeshRef.current;
                if (points) {
                    for (let i = 0; i < FACE_MESH_VERTEX_COUNT; i++) {
                        positions[i * 3] = points[i].x;
                        positions[i * 3 + 1] = 1 - points[i].y;
                        positions[i * 3 + 2] = -points[i].z; // MediaPipe z shrinks toward the camera; three's grows
                    }
                    geometry.attributes.position.needsUpdate = true;
                }
                renderer.render(scene, camera);
            };
            tick();
            setStatus("running");
        }
        catch (err) {
            restoreConsole();
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
        }
    }
    // The pad is shown mirrored, like the webcam, so paint on your left lands on the left of the
    // face you see. Pointer x is flipped back to find the pixel on the unmirrored texture.
    function padPoint(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            x: (1 - (e.clientX - rect.left) / rect.width) * PAD_SIZE,
            y: ((e.clientY - rect.top) / rect.height) * PAD_SIZE,
        };
    }
    function strokeTo(point) {
        const ctx = paintRef.current?.getContext("2d");
        if (!ctx)
            return;
        const from = lastPoint.current ?? point;
        ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = brush;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPoint.current = point;
        markDirty();
    }
    function markDirty() {
        if (sessionRef.current)
            sessionRef.current.texture.needsUpdate = true;
    }
    function clearPaint() {
        const ctx = paintRef.current?.getContext("2d");
        ctx?.clearRect(0, 0, PAD_SIZE, PAD_SIZE);
        markDirty();
    }
    // A preset in the unwrap's own coordinates: a band across the eyes (the eyes sit near v = 0.62).
    function eyeMask() {
        const ctx = paintRef.current?.getContext("2d");
        if (!ctx)
            return;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(0.12 * PAD_SIZE, (1 - 0.7) * PAD_SIZE, 0.76 * PAD_SIZE, 0.15 * PAD_SIZE, 0.07 * PAD_SIZE);
        ctx.fill();
        markDirty();
    }
    // The template is the wireframe unwrap as a PNG, to paint over in Procreate or Photoshop
    // and load back in, the same round trip as a Lens Studio face texture.
    function downloadTemplate() {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = PAD_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return;
        drawWireframe(ctx, "rgba(0,0,0,0.5)");
        const link = document.createElement("a");
        link.download = "face-template.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    }
    function loadImage(file) {
        const img = new Image();
        img.onload = () => {
            const ctx = paintRef.current?.getContext("2d");
            if (!ctx)
                return;
            ctx.globalCompositeOperation = "source-over";
            ctx.clearRect(0, 0, PAD_SIZE, PAD_SIZE);
            ctx.drawImage(img, 0, 0, PAD_SIZE, PAD_SIZE);
            URL.revokeObjectURL(img.src);
            markDirty();
        };
        img.src = URL.createObjectURL(file);
    }
    return (<div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
      <section>
        <div className="relative overflow-hidden rounded-lg bg-zinc-900 aspect-video">
          <div className="absolute inset-0 -scale-x-100">
            {/* The video only feeds frames to the tracker; what you see is drawn on the canvas. */}
            <video ref={videoRef} className="absolute inset-0 h-full w-full opacity-0" playsInline muted/>
            <canvas ref={stageRef} className="absolute inset-0 h-full w-full object-contain"/>
          </div>
          {status !== "running" && (<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {status === "error" ? (<p className="text-sm text-rose-400">Could not start: {error}</p>) : null}
              <button onClick={start} disabled={status === "loading"} className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black disabled:opacity-50">
                {status === "loading" ? "Loading the face tracker…" : "Start camera"}
              </button>
            </div>)}
          {status === "running" && !faceFound && (<p className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 font-mono text-xs text-zinc-300">
              looking for a face…
            </p>)}
        </div>
      </section>

      <section>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg">
          <div className="absolute inset-0 -scale-x-100">
            <canvas ref={guideRef} width={PAD_SIZE} height={PAD_SIZE} className="absolute inset-0 h-full w-full"/>
          </div>
          <canvas ref={paintRef} width={PAD_SIZE} height={PAD_SIZE} className="absolute inset-0 h-full w-full -scale-x-100 cursor-crosshair touch-none" onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            lastPoint.current = null;
            strokeTo(padPoint(e));
        }} onPointerMove={(e) => {
            if (e.buttons)
                strokeTo(padPoint(e));
        }} onPointerUp={() => (lastPoint.current = null)}/>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {SWATCHES.map((s) => (<button key={s} aria-label={`paint ${s}`} onClick={() => {
                setColor(s);
                setErasing(false);
            }} className={`h-7 w-7 rounded-full border-2 ${color === s && !erasing ? "border-white" : "border-zinc-700"}`} style={{ background: s }}/>))}
          <input type="color" value={color} onChange={(e) => {
            setColor(e.target.value);
            setErasing(false);
        }} className="h-7 w-9 cursor-pointer rounded bg-transparent" aria-label="custom color"/>
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm text-zinc-400">
          brush
          <input type="range" min={4} max={120} value={brush} onChange={(e) => setBrush(Number(e.target.value))}/>
          <span className="font-mono text-xs">{brush}px</span>
        </label>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Toggle on={erasing} onClick={() => setErasing(!erasing)}>
            eraser
          </Toggle>
          <Toggle on={showMesh} onClick={() => setShowMesh(!showMesh)}>
            show mesh
          </Toggle>
          <Button onClick={eyeMask}>eye mask</Button>
          <Button onClick={clearPaint}>clear</Button>
          <Button onClick={downloadTemplate}>download template</Button>
          <label className="cursor-pointer rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-400">
            load image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
                loadImage(file);
            e.target.value = "";
        }}/>
          </label>
        </div>
      </section>
    </div>);
}
function drawWireframe(ctx, stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 0; t < FACE_MESH_TRIANGLES.length; t += 3) {
        for (let k = 0; k < 3; k++) {
            const i = FACE_MESH_TRIANGLES[t + k];
            const x = FACE_MESH_UVS[i * 2] * PAD_SIZE;
            const y = (1 - FACE_MESH_UVS[i * 2 + 1]) * PAD_SIZE;
            if (k === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.closePath();
    }
    ctx.stroke();
}
function stop(session) {
    if (!session)
        return;
    cancelAnimationFrame(session.frame);
    session.stream.getTracks().forEach((t) => t.stop());
    session.landmarker.close();
    session.renderer.dispose();
    session.restoreConsole();
}
// MediaPipe's WASM prints startup notes ("INFO: Created TensorFlow Lite XNNPACK delegate...")
// through console.error, which Next's dev overlay shows as an error. Drop just those lines.
function quietMediaPipeInfo() {
    const original = console.error;
    console.error = (...args) => {
        if (typeof args[0] === "string" && args[0].startsWith("INFO:"))
            return;
        original(...args);
    };
    return () => {
        console.error = original;
    };
}
function Button({ children, onClick }) {
    return (<button onClick={onClick} className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300 hover:border-zinc-400">
      {children}
    </button>);
}
function Toggle({ children, on, onClick }) {
    return (<button onClick={onClick} className={`rounded-full border px-3 py-1 ${on ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-300 hover:border-zinc-400"}`}>
      {children}
    </button>);
}
