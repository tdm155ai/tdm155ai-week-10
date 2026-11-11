"use client";

// /launch/hello: the whole thing in one file. Read it top to bottom, then change the settings below.
// 1. Listen for key presses on the page.
// 2. If it's our key (or someone clicks the button), fire a cue on the stage (/stage, open in another window).

import { useEffect, useState } from "react";
import { fireCue, openStage } from "../../../lib/stage/stage.js";

// ── Change these ──────────────────────────────────────────────────────────────
const KEY = "h"; // press this key...
const CUE = { id: "hello", label: "Hello, world", kind: "text", src: "Hello, world", options: { size: "12vw" } }; // ...and this happens
// Other cues to try: { kind: "sound", src: "/samples/ping.mp3" }  { kind: "image", src: "/samples/moon.svg" }  { kind: "color", src: "crimson" }
// ──────────────────────────────────────────────────────────────────────────────

export default function Hello() {
  const [fired, setFired] = useState(0);

  const go = () => {
    fireCue(CUE);
    setFired((n) => n + 1);
  };

  // 1. Every key press on this page comes here. 2. Ours? Fire.
  useEffect(() => {
    const onKey = (event) => { if (event.key.toLowerCase() === KEY) go(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey); // tidy up when you leave the page
  }, []);

  return (
    <div className="ctl-panel">
      <div className="ctl-row">
        <button className="ctl-btn" onClick={() => openStage()}>Open the stage</button>
        <button className="ctl-btn primary" onClick={go}>Fire: {CUE.label}</button>
      </div>
      <p className="ctl-note">Press <code>{KEY}</code> or click the button. Fired {fired} time{fired === 1 ? "" : "s"}.</p>
      <p className="ctl-note">This page is one file: <code>nextjs/app/launch/hello/Hello.jsx</code>. Change <code>KEY</code> and <code>CUE</code> at the top and save. The fuller version (nine buttons, Go) is <a href="/launch">Buttons and keys</a>.</p>
    </div>
  );
}
