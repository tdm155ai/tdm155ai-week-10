"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import BlobEffects, { RESET_SECONDS } from "./effects.jsx";
import { emptyFeed, useTrackers } from "./use-trackers.js";
import { CHANNEL } from "./shared.js";
export default function Display() {
    const feed = useRef(emptyFeed());
    const [live, setLive] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [resetSignal, setResetSignal] = useState(0);
    const [resets, setResets] = useState(0);
    const onReset = useCallback((n) => setResets(n), []);
    const trackers = useTrackers(feed, setLive);
    useEffect(() => {
        const channel = new BroadcastChannel(CHANNEL);
        channel.onmessage = (e) => {
            feed.current = { msg: e.data, at: performance.now() };
        };
        return () => channel.close();
    }, []);
    useEffect(() => {
        const onChange = () => setFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);
    const toggleFullscreen = () => {
        if (document.fullscreenElement)
            void document.exitFullscreen();
        else
            void document.documentElement.requestFullscreen();
    };
    return (<div onDoubleClick={toggleFullscreen} style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", cursor: fullscreen ? "none" : "default" }}>
      <BlobEffects trackers={trackers} resetSignal={resetSignal} onReset={onReset}/>
      {!fullscreen && (<div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 12, alignItems: "center", color: "#a0a49a", font: "13px system-ui" }}>
          <span>{live ? "● tracking" : "○ waiting for camera"}</span>
          <button className="btn" onClick={toggleFullscreen}>Fullscreen</button>
          <span>or double-click</span>
          <button className="btn" onClick={() => setResetSignal((n) => n + 1)}>Reset the splash</button>
          <span>(it also starts fresh every {RESET_SECONDS} s · {resets} so far)</span>
        </div>)}
    </div>);
}
