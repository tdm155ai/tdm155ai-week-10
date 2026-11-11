"use client";

// /voice/hello: the whole thing in one file. Read it top to bottom, then change the settings below.
// 1. Ask Chrome to listen (its Web Speech API: free, no key, needs the internet).
// 2. Every time it hears something, look for the word.
// 3. If the word is there, fire a cue on the stage (/stage, open in another window).

import { useEffect, useRef, useState } from "react";
import { fireCue, openStage } from "../../../lib/stage/stage.js";

// ── Change these ──────────────────────────────────────────────────────────────
const WORD = "hello"; // say this...
const CUE = { id: "hello", label: "Hello, world", kind: "text", src: "Hello, world", options: { size: "12vw" } }; // ...and this happens
// Other cues to try: { kind: "sound", src: "/samples/ping.mp3" }  { kind: "image", src: "/samples/moon.svg" }  { kind: "color", src: "crimson" }
// ──────────────────────────────────────────────────────────────────────────────

export default function Hello() {
  const [heard, setHeard] = useState("");
  const [fired, setFired] = useState(0);
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef(null);

  const listen = () => {
    // 1. Chrome's speech recognizer. continuous: keep going; interimResults: give us words while they're being said.
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return setHeard("This browser can't listen. Use Chrome.");
    const recognizer = new Recognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = "en-US";
    let lastFired = 0;

    // 2. Each time it hears something: the newest phrase, as text.
    recognizer.onresult = (event) => {
      const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
      setHeard(text);
      // 3. The word is in it (and we haven't just fired): fire the cue.
      if (text.includes(WORD) && Date.now() - lastFired > 2000) {
        lastFired = Date.now();
        fireCue(CUE);
        setFired((n) => n + 1);
      }
    };
    recognizer.onend = () => { if (recognizerRef.current === recognizer) recognizer.start(); }; // Chrome stops after a silence: start it again
    recognizer.onerror = (event) => {
      if (event.error === "not-allowed") { recognizerRef.current = null; setListening(false); setHeard("Chrome wasn't allowed to use the mic."); }
    };
    recognizerRef.current = recognizer;
    recognizer.start();
    setListening(true);
  };

  // Leaving the page: stop listening.
  useEffect(() => () => { const r = recognizerRef.current; recognizerRef.current = null; r?.stop(); }, []);

  return (
    <div className="ctl-panel">
      <div className="ctl-row">
        <button className="ctl-btn" onClick={() => openStage()}>Open the stage</button>
        <button className="ctl-btn primary" onClick={listen} disabled={listening}>{listening ? "Listening…" : "Start listening"}</button>
      </div>
      <p className="ctl-note">Say “{WORD}”. Fired {fired} time{fired === 1 ? "" : "s"}.</p>
      <div className="transcript"><p className={heard ? "" : "interim"}>{heard || "What Chrome hears shows up here."}</p></div>
      <p className="ctl-note">This page is one file: <code>nextjs/app/voice/hello/Hello.jsx</code>. Change <code>WORD</code> and <code>CUE</code> at the top and save. The fuller version (many words, mic choice, typed lines) is <a href="/voice">Say a word</a>.</p>
    </div>
  );
}
