"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onStage } from "../stage/stage.js";
import { meter, openMic } from "../voice/mic.js";
import HandPoint from "./HandPoint.jsx";
import * as shader from "./shader.js";
import * as kaleidoscope from "./kaleidoscope.js";
import * as particles from "./particles.js";

// The shader pages (/launch/shader, /launch/kaleidoscope, /launch/particles): a fragment shader drawn with plain
// WebGL (no library). Each page's shader is one file in lib/launch/ with `controls` (the sliders, one u_ uniform
// each) and `fragment` (the GLSL); optional `feedback` (the shader gets its last frame as u_prev, for trails),
// `hand` (what a hand does when "Use my hand" is on), and `maxDpr` (how sharp to render). Inputs: sliders, the
// pointer (u_mouse; a press is a pinch), the mic (u_level), stage controls (setParam), a hand (CV's MediaPipe helpers).
// F = full screen, Space = pause.

const SHADERS = {
  shader: { module: shader, file: "nextjs/lib/launch/shader.js" },
  kaleidoscope: { module: kaleidoscope, file: "nextjs/lib/launch/kaleidoscope.js" },
  particles: { module: particles, file: "nextjs/lib/launch/particles.js" },
};

const VERTEX = "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"; // one rectangle over the canvas
const COPY = "precision mediump float; uniform sampler2D u_tex; uniform vec2 u_resolution; void main() { gl_FragColor = texture2D(u_tex, gl_FragCoord.xy / u_resolution); }";

function compile(gl, source) {
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragment, source);
  gl.compileShader(fragment);
  if (!gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(fragment); gl.deleteShader(fragment); throw new Error(log || "the shader didn't compile"); }
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertex, VERTEX);
  gl.compileShader(vertex);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "a");
  gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "the shader didn't link");
  return program;
}

// Two picture-sized textures to draw into, taking turns (this frame reads the last one): "ping-pong" feedback.
function makeTargets(gl, w, h) {
  return [0, 1].map(() => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo };
  });
}

export default function ShaderView({ which = "shader" }) {
  const { module: mod, file } = SHADERS[which] || SHADERS.shader;
  const { controls, fragment: fileFragment } = mod;
  const handMap = mod.hand || null;
  const initial = useCallback(() => Object.fromEntries(controls.map((c) => [c.name, c.value])), [controls]);
  const [values, setValues] = useState(initial);
  const [source, setSource] = useState(fileFragment);
  const [draft, setDraft] = useState(fileFragment);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [listening, setListening] = useState(false);
  const [useHand, setUseHand] = useState(false);
  const [handSeen, setHandSeen] = useState("");
  const [fps, setFps] = useState(0);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const glRef = useRef(null); // { gl, program, copy, buffer, targets, size }
  const valuesRef = useRef(values);
  const input = useRef({ mouse: [0.5, 0.5], level: 0, time: 0, paused: false, pinch: false, burst: 0, hand: null });
  const micStop = useRef(null);

  useEffect(() => { valuesRef.current = values; }, [values]);
  useEffect(() => { input.current.paused = paused; }, [paused]);
  // Saving the shader's file brings the new shader in.
  useEffect(() => { setSource(fileFragment); setDraft(fileFragment); }, [fileFragment]);

  const press = useCallback((down) => {
    const s = input.current;
    if (down && !s.pinch) s.burst = 1; // a new pinch or click: a burst
    s.pinch = down;
  }, []);

  // WebGL: set up once, draw every frame, clean up on the way out.
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false });
    if (!gl) { setError("This browser has no WebGL."); return undefined; }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const g = { gl, program: null, copy: mod.feedback ? compile(gl, COPY) : null, buffer, targets: null, size: "", turn: 0 };
    glRef.current = g;
    const dropTargets = () => { g.targets?.forEach(({ tex, fbo }) => { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); }); g.targets = null; };

    let raf = 0, last = performance.now(), frames = 0, fpsAt = last;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const state = input.current, v = valuesRef.current;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const frozen = state.paused || (handMap?.pinch === "freeze" && state.pinch);
      if (!frozen) state.time += dt * (v.speed ?? 1); // speed changes the rate, so it never jumps
      state.burst *= Math.pow(0.25, dt); // a burst fades over about a second
      if (!g.program) return;
      const dpr = Math.min(mod.maxDpr ?? 1.5, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      if (mod.feedback && g.size !== `${w}x${h}`) { dropTargets(); g.targets = makeTargets(gl, w, h); g.size = `${w}x${h}`; }

      const { program } = g;
      gl.useProgram(program);
      const u = (name) => gl.getUniformLocation(program, name);
      gl.uniform2f(u("u_resolution"), w, h);
      gl.uniform1f(u("u_time"), state.time);
      gl.uniform2f(u("u_mouse"), state.mouse[0], state.mouse[1]);
      gl.uniform1f(u("u_level"), state.level);
      gl.uniform1f(u("u_pinch"), state.pinch ? 1 : 0);
      gl.uniform1f(u("u_burst"), state.burst);
      for (const c of controls) gl.uniform1f(u(`u_${c.name}`), v[c.name] ?? c.value);
      gl.viewport(0, 0, w, h);
      if (mod.feedback) {
        // Draw into the next texture, reading the last one, then copy the result to the screen.
        const [from, to] = g.turn ? [g.targets[1], g.targets[0]] : [g.targets[0], g.targets[1]];
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, from.tex);
        gl.uniform1i(u("u_prev"), 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(g.copy);
        gl.bindTexture(gl.TEXTURE_2D, to.tex);
        gl.uniform1i(gl.getUniformLocation(g.copy, "u_tex"), 0);
        gl.uniform2f(gl.getUniformLocation(g.copy, "u_resolution"), w, h);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        g.turn = 1 - g.turn;
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      frames += 1;
      if (now - fpsAt > 1000) { setFps(Math.round((frames * 1000) / (now - fpsAt))); frames = 0; fpsAt = now; }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      if (g.program) gl.deleteProgram(g.program);
      if (g.copy) gl.deleteProgram(g.copy);
      dropTargets();
      gl.deleteBuffer(buffer); // (not loseContext: React mounts twice in development and would get a dead context)
      glRef.current = null;
    };
  }, [mod, controls, handMap]);

  // Compile whenever the source changes; on an error keep drawing the last shader that worked.
  useEffect(() => {
    const g = glRef.current;
    if (!g) return;
    try {
      const program = compile(g.gl, source);
      if (g.program) g.gl.deleteProgram(g.program);
      g.program = program;
      setError("");
    } catch (e) { setError(e.message); }
  }, [source]);

  // Stage controls (a MIDI knob, the XY pad, a hand on /track) move the sliders that name them.
  useEffect(() => onStage((m) => {
    if (m.type !== "param") return;
    const c = controls.find((x) => x.param === m.name);
    if (c) setValues((v) => ({ ...v, [c.name]: c.min + m.value * (c.max - c.min) }));
  }), [controls]);

  // The pointer over the picture: 0–1 across and up; pressing is a pinch.
  const onPointer = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    input.current.mouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  };

  // A hand (when "Use my hand" is on): point, pinch, and the sliders named in the shader's `hand`.
  const onHand = useCallback((h) => {
    const s = input.current;
    setHandSeen((prev) => (prev === (h.present ? (h.pinch ? "pinch" : "hand") : "no hand") ? prev : (h.present ? (h.pinch ? "pinch" : "hand") : "no hand")));
    if (!h.present) { if (s.handPinch) { s.handPinch = false; press(false); } return; }
    if (handMap?.point) s.mouse = [h.x, h.y];
    if (h.pinch !== !!s.handPinch) { s.handPinch = h.pinch; press(h.pinch); }
    const updates = {};
    for (const axis of ["x", "y"]) {
      const c = controls.find((x) => x.name === handMap?.[axis]);
      if (c) updates[c.name] = c.min + h[axis] * (c.max - c.min);
    }
    if (Object.keys(updates).length) setValues((v) => ({ ...v, ...updates }));
  }, [controls, handMap, press]);

  // Listen: the mic's loudness becomes u_level.
  const listen = async () => {
    if (micStop.current) { micStop.current(); micStop.current = null; input.current.level = 0; setListening(false); return; }
    try {
      const stream = await openMic();
      const stopMeter = meter(stream, (rms) => { input.current.level += (Math.min(1, rms * 6) - input.current.level) * 0.3; });
      micStop.current = () => { stopMeter(); stream.getTracks().forEach((t) => t.stop()); };
      setListening(true);
    } catch (e) { setError(`mic: ${e.message}`); }
  };
  useEffect(() => () => micStop.current?.(), []);

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.key === "f" || e.key === "F") fullscreen();
      if (e.code === "Space") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const pinchWord = handMap?.pinch === "freeze" ? "freezes time" : handMap?.pinch === "burst" ? "bursts" : null;
  const handWords = handMap && [handMap.point && "your palm moves the center", handMap.x && `across = ${controls.find((c) => c.name === handMap.x)?.label}`, handMap.y && `up = ${controls.find((c) => c.name === handMap.y)?.label}`, pinchWord && `pinch ${pinchWord}`].filter(Boolean).join(", ");

  return (
    <div className="ctl-grid">
      <div>
        <div ref={wrapRef} className="shader-wrap" onDoubleClick={fullscreen}>
          <canvas ref={canvasRef} className="shader-canvas" onPointerMove={onPointer}
            onPointerDown={(e) => { onPointer(e); press(true); }} onPointerUp={() => press(false)} onPointerLeave={() => press(false)} />
          {useHand && <HandPoint onHand={onHand} />}
        </div>
        <div className="ctl-row" style={{ marginTop: 10 }}>
          <button className="ctl-btn" onClick={fullscreen}>Full screen (F)</button>
          <button className={paused ? "ctl-btn on" : "ctl-btn"} onClick={() => setPaused((p) => !p)}>{paused ? "Paused (Space)" : "Pause (Space)"}</button>
          {handMap && <button className={useHand ? "ctl-btn on" : "ctl-btn"} onClick={() => setUseHand((v) => !v)}>{useHand ? `Hand on (${handSeen || "starting"})` : "Use my hand"}</button>}
          {which === "shader" && <button className={listening ? "ctl-btn on" : "ctl-btn"} onClick={listen}>{listening ? "Listening: rings follow the sound" : "Listen (mic → rings)"}</button>}
          <span className="ctl-status">{fps ? `${fps} fps` : ""}</span>
        </div>
        {handWords && <p className="ctl-note">Hand: {handWords}. No camera? {handMap.point ? "Move the pointer; click" : "Hold the mouse button"} {pinchWord ? `to ${pinchWord === "bursts" ? "burst" : "freeze"}` : ""}.</p>}
        {error && <pre className="shader-error">{error}</pre>}
        <div className="ctl-panel" style={{ marginTop: 14 }}>
          <div className="ctl-row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>The shader (GLSL): edit and Run</h2>
            <div className="ctl-row">
              <button className="ctl-btn primary" onClick={() => setSource(draft)}>Run</button>
              <button className="ctl-btn" onClick={() => { setDraft(fileFragment); setSource(fileFragment); }}>Back to the file</button>
            </div>
          </div>
          <textarea className="shader-code" value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") setSource(draft); }} />
          <p className="ctl-note">⌘/Ctrl + Enter runs it. A mistake shows the error above and keeps the last picture that worked. To keep your changes, paste them into <code>fragment</code> in <code>{file}</code>.</p>
        </div>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Parameters</h2>
          {controls.map((c) => (
            <label key={c.name} className="slider-row" style={{ gridTemplateColumns: "110px minmax(0,1fr) 48px" }}>
              <span>{c.label}</span>
              <input type="range" min={c.min} max={c.max} step={(c.max - c.min) / 200} value={values[c.name]} onChange={(e) => setValues((v) => ({ ...v, [c.name]: Number(e.target.value) }))} />
              <output>{Number(values[c.name]).toFixed(2)}</output>
            </label>
          ))}
          <div className="ctl-row" style={{ marginTop: 8 }}><button className="ctl-btn" onClick={() => setValues(initial())}>Reset</button></div>
          <p className="ctl-note">Each slider is a <code>u_</code> number in the shader ({controls[0].label} → <code>u_{controls[0].name}</code>). Change the list in <code>{file}</code>.</p>
        </div>
        <div className="ctl-panel">
          <h2>Inputs → parameters → pixels</h2>
          <ul className="ctl-log" style={{ maxHeight: "none" }}>
            <li><b>Sliders</b> → each <code>u_</code> uniform</li>
            <li><b>Pointer</b> over the picture → <code>u_mouse</code>; pressing → <code>u_pinch</code>, <code>u_burst</code></li>
            {which === "shader" && <li><b>Mic</b> (Listen) → <code>u_level</code> (how bright the rings are)</li>}
            {handMap && <li><b>Hand</b> (Use my hand) → {handWords}</li>}
            {mod.feedback && <li><b>The last frame</b> → <code>u_prev</code> (trails)</li>}
            {controls.filter((c) => c.param).map((c) => <li key={c.name}><b>Stage control “{c.param}”</b> → {c.label}{c.param === "filter" ? " (the XY pad, /launch/xy or /track/xy)" : c.param === "resonance" ? " (the XY pad's up–down)" : " (a MIDI knob on /launch/midi)"}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
