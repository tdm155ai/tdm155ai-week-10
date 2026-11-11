"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onStage } from "../stage/stage.js";
import { meter, openMic } from "../voice/mic.js";
import { controls, fragment as fileFragment } from "./shader.js";

// /launch/shader: a fragment shader drawn with plain WebGL (no library), its sliders from lib/launch/shader.js, the
// pointer, the mic's loudness, and stage controls (setParam) as inputs. Edit the GLSL on the page and press Run, or
// edit the file and save. F = full screen, Space = pause.

const VERTEX = "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"; // one rectangle over the canvas
const initial = () => Object.fromEntries(controls.map((c) => [c.name, c.value]));

function compile(gl, source) {
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(log || "the shader didn't compile"); }
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertex, VERTEX);
  gl.compileShader(vertex);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, shader);
  gl.bindAttribLocation(program, 0, "a");
  gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "the shader didn't link");
  return program;
}

export default function ShaderView() {
  const [values, setValues] = useState(initial);
  const [source, setSource] = useState(fileFragment);
  const [draft, setDraft] = useState(fileFragment);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [listening, setListening] = useState(false);
  const [fps, setFps] = useState(0);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const glRef = useRef(null); // { gl, program }
  const valuesRef = useRef(values);
  const input = useRef({ mouse: [0.5, 0.5], level: 0, time: 0, paused: false });
  const micStop = useRef(null);

  useEffect(() => { valuesRef.current = values; }, [values]);
  useEffect(() => { input.current.paused = paused; }, [paused]);
  // Saving lib/launch/shader.js brings the new shader in.
  useEffect(() => { setSource(fileFragment); setDraft(fileFragment); }, [fileFragment]);

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
    glRef.current = { gl, program: null, buffer };

    let raf = 0, last = performance.now(), frames = 0, fpsAt = last;
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const state = input.current, v = valuesRef.current;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!state.paused) state.time += dt * (v.speed ?? 1); // speed changes the rate, so it never jumps
      const { program } = glRef.current;
      if (!program) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      const u = (name) => gl.getUniformLocation(program, name);
      gl.uniform2f(u("u_resolution"), w, h);
      gl.uniform1f(u("u_time"), state.time);
      gl.uniform2f(u("u_mouse"), state.mouse[0], state.mouse[1]);
      gl.uniform1f(u("u_level"), state.level);
      for (const c of controls) gl.uniform1f(u(`u_${c.name}`), v[c.name] ?? c.value);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frames += 1;
      if (now - fpsAt > 1000) { setFps(Math.round((frames * 1000) / (now - fpsAt))); frames = 0; fpsAt = now; }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      const g = glRef.current;
      if (g?.program) gl.deleteProgram(g.program);
      gl.deleteBuffer(buffer); // (not loseContext: React mounts twice in development and would get a dead context)
      glRef.current = null;
    };
  }, []);

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

  // Stage controls (a MIDI knob, the XY pad, a hand) move the sliders that name them.
  useEffect(() => onStage((m) => {
    if (m.type !== "param") return;
    const c = controls.find((x) => x.param === m.name);
    if (c) setValues((v) => ({ ...v, [c.name]: c.min + m.value * (c.max - c.min) }));
  }), []);

  // The pointer over the picture: 0–1 across and up.
  const onPointer = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    input.current.mouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  };

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

  return (
    <div className="ctl-grid">
      <div>
        <div ref={wrapRef} className="shader-wrap" onDoubleClick={fullscreen}>
          <canvas ref={canvasRef} className="shader-canvas" onPointerMove={onPointer} onPointerDown={onPointer} />
        </div>
        <div className="ctl-row" style={{ marginTop: 10 }}>
          <button className="ctl-btn" onClick={fullscreen}>Full screen (F)</button>
          <button className={paused ? "ctl-btn on" : "ctl-btn"} onClick={() => setPaused((p) => !p)}>{paused ? "Paused (Space)" : "Pause (Space)"}</button>
          <button className={listening ? "ctl-btn on" : "ctl-btn"} onClick={listen}>{listening ? "Listening: rings follow the sound" : "Listen (mic → rings)"}</button>
          <span className="ctl-status">{fps ? `${fps} fps` : ""}</span>
        </div>
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
          <p className="ctl-note">⌘/Ctrl + Enter runs it. A mistake shows the error above and keeps the last picture that worked. To keep your changes, paste them into <code>fragment</code> in <code>nextjs/lib/launch/shader.js</code>.</p>
        </div>
      </div>
      <div>
        <div className="ctl-panel">
          <h2>Parameters</h2>
          {controls.map((c) => (
            <label key={c.name} className="slider-row" style={{ gridTemplateColumns: "100px minmax(0,1fr) 48px" }}>
              <span>{c.label}</span>
              <input type="range" min={c.min} max={c.max} step={(c.max - c.min) / 200} value={values[c.name]} onChange={(e) => setValues((v) => ({ ...v, [c.name]: Number(e.target.value) }))} />
              <output>{Number(values[c.name]).toFixed(2)}</output>
            </label>
          ))}
          <div className="ctl-row" style={{ marginTop: 8 }}><button className="ctl-btn" onClick={() => setValues(initial())}>Reset</button></div>
          <p className="ctl-note">Each slider is a <code>u_</code> number in the shader (Speed → <code>u_speed</code>). Change the list in <code>nextjs/lib/launch/shader.js</code>.</p>
        </div>
        <div className="ctl-panel">
          <h2>Inputs → parameters → pixels</h2>
          <ul className="ctl-log" style={{ maxHeight: "none" }}>
            <li><b>Sliders</b> → each <code>u_</code> uniform</li>
            <li><b>Pointer</b> over the picture → <code>u_mouse</code> (where the rings start)</li>
            <li><b>Mic</b> (Listen) → <code>u_level</code> (how bright the rings are)</li>
            {controls.filter((c) => c.param).map((c) => <li key={c.name}><b>Stage control “{c.param}”</b> → {c.label}{c.param === "filter" ? " (the XY pad, /launch/xy or /track/xy)" : " (a MIDI knob on /launch/midi)"}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
