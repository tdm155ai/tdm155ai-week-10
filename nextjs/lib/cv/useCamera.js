"use client";

// The camera for /track and /draw-a-box: opens a camera, lists the others, remembers your choice per page.
// Adapted from the capture kit (ll-kits/kits/capture/nextjs/app/capture/useCamera.js), without the microphone.
// `attach` is a ref callback for the <video>; `videoRef.current` is the element to hand to MediaPipe or OpenCV.

import { useCallback, useEffect, useRef, useState } from "react";

function remember(key, value) { try { localStorage.setItem(key, value); } catch {} }
function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }

export function useCamera({ storageKey = "cv-camera", width = 1280, height = 720 } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [size, setSize] = useState("");
  const [status, setStatus] = useState({ tone: "muted", text: "Starting the camera…" });

  const attach = useCallback((element) => {
    videoRef.current = element;
    if (element && streamRef.current && element.srcObject !== streamRef.current) element.srcObject = streamRef.current;
  }, []);

  const start = useCallback(async (id) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const video = { width: { ideal: width }, height: { ideal: height } };
    if (id) video.deviceId = { exact: id };
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    const settings = stream.getVideoTracks()[0]?.getSettings() || {};
    if (settings.width) setSize(`${settings.width}×${settings.height}`);
    return settings.deviceId || id || "";
  }, [width, height]);

  // Open a camera first so the browser reveals device names, then switch to the one saved for this page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({ tone: "error", text: "This browser can't open a camera here. Use Chrome, at http://localhost:3000 on this machine." });
        return;
      }
      try {
        const saved = recall(storageKey) || "";
        let current;
        try { current = await start(saved); } catch (error) {
          if (!saved || error.name === "NotAllowedError") throw error;
          remember(storageKey, "");
          current = await start("");
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const cams = devices.filter((device) => device.kind === "videoinput");
        setCameras(cams);
        setCameraId(current || cams[0]?.deviceId || "");
        setStatus({ tone: "muted", text: "Camera ready." });
      } catch (error) {
        setStatus({ tone: "error", text: error.name === "NotAllowedError" ? "Camera permission was refused. Click the camera icon in the address bar, allow it, and reload." : `Couldn't open a camera: ${error.message}` });
      }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [start, storageKey]);

  const chooseCamera = useCallback(async (id) => {
    setCameraId(id);
    remember(storageKey, id);
    try { await start(id); setStatus({ tone: "muted", text: "Camera ready." }); } catch (error) { setStatus({ tone: "error", text: `Couldn't open that camera: ${error.message}` }); }
  }, [start, storageKey]);

  return { attach, videoRef, cameras, cameraId, chooseCamera, size, status, setStatus };
}
