"use client";

// The live voice filter and the scare sounds for /track/horror, all Web Audio in this tab:
//
//   mic → catch → gate → pitch A ┐                                                  ┌→ dry ────┐
//                      → pitch B ┴→ low cut → high cut → growl → wobble → (voice) ─┼→ echo ───┼→ voice out ┬→ speakers (Live out)
//                                                                                  └→ reverb ─┘            └→ the recording
//   drone, heartbeat, whispers, stinger, boom ───────────────────────────────────────────────────────────┘
//
// Two voice modes (the "catch" step):
//   "live":  the mic goes straight through, as you speak (20–70 ms late).
//   "catch": it catches what you say (quietly is fine), and the moment you pause it plays the phrase back, as loud as
//            a shout, through the filter. While it plays it doesn't listen, so the speakers can't feed back into it.
// Pitch shifting is a small AudioWorklet (below): two read heads sweep through a short delay line and cross-fade,
// which plays the voice faster or slower without changing its timing.
// Nothing leaves the browser; the recording is MediaRecorder on this page.

const WORKLET = `
class HorrorCatch extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "mode", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },      // 0 live, 1 catch
      { name: "threshold", defaultValue: 0.01, minValue: 0, maxValue: 1, automationRate: "k-rate" }, // talking starts above this
      { name: "silence", defaultValue: 0.35, minValue: 0.05, maxValue: 3, automationRate: "k-rate" }, // a pause this long ends a phrase
      { name: "cooldown", defaultValue: 0.6, minValue: 0, maxValue: 5, automationRate: "k-rate" },  // deaf this long after playing
    ];
  }
  constructor() {
    super();
    this.max = Math.round(sampleRate * 10);
    this.buf = new Float32Array(this.max);
    this.pre = new Float32Array(Math.round(sampleRate * 0.15)); // just before talking started (soft first sounds)
    this.preW = 0;
    this.len = 0; this.play = 0; this.gain = 1;
    this.state = "idle"; this.quiet = 0; this.voiced = 0; this.env = 0; this.open = 0; this.cool = 0;
    this.fade = Math.round(sampleRate * 0.006);
    this.port.onmessage = (e) => { if (e.data === "cancel") { this.state = "idle"; this.len = 0; this.tell(); } };
  }
  tell(extra) { this.port.postMessage(Object.assign({ state: this.state, seconds: this.len / sampleRate }, extra || {})); }
  finish(silenceSamples) {
    const keep = Math.round(sampleRate * 0.12);
    this.len = Math.max(0, this.len - Math.max(0, this.quiet - keep));
    if (this.voiced < sampleRate * 0.15) { this.state = "idle"; this.len = 0; this.tell({ dropped: true }); return; }
    let peak = 1e-6;
    for (let i = 0; i < this.len; i++) peak = Math.max(peak, Math.abs(this.buf[i]));
    this.gain = Math.min(0.7 / peak, 40);
    this.play = 0;
    this.state = "playing";
    this.tell();
  }
  process(inputs, outputs, params) {
    const channels = inputs[0] || [];
    const out = outputs[0][0];
    const n = out.length;
    if (params.mode[0] < 0.5) {
      if (this.state !== "idle") { this.state = "idle"; this.len = 0; this.tell(); }
      for (let i = 0; i < n; i++) { let x = 0; for (let c = 0; c < channels.length; c++) x += channels[c][i]; out[i] = x; }
      return true;
    }
    const threshold = params.threshold[0];
    const silenceSamples = params.silence[0] * sampleRate;
    for (let i = 0; i < n; i++) {
      let x = 0;
      for (let c = 0; c < channels.length; c++) x += channels[c][i];
      this.env = Math.max(Math.abs(x), this.env * 0.9993);
      // A soft gate inside the phrase: the gaps between words stay quiet when the phrase is made loud.
      this.open += ((this.env > threshold * 0.6 ? 1 : 0) - this.open) * (this.env > threshold * 0.6 ? 0.02 : 0.0003);
      out[i] = 0;
      if (this.state === "idle") {
        this.pre[this.preW] = x;
        this.preW = (this.preW + 1) % this.pre.length;
        if (this.env > threshold) {
          this.len = 0;
          const m = this.pre.length;
          for (let k = 0; k < m; k++) this.buf[this.len++] = this.pre[(this.preW + k) % m] * (k / m); // faded in
          this.quiet = 0; this.voiced = 0;
          this.state = "catching";
          this.tell();
        }
      } else if (this.state === "catching") {
        this.buf[this.len++] = x * this.open;
        if (this.env > threshold) { this.quiet = 0; this.voiced++; } else this.quiet++;
        if (this.quiet > silenceSamples || this.len >= this.max) this.finish(silenceSamples);
      } else if (this.state === "playing") {
        const p = this.play;
        const edge = Math.min(1, p / this.fade, (this.len - p) / this.fade);
        out[i] = p < this.len ? this.buf[p] * this.gain * Math.max(0, edge) : 0;
        this.play++;
        if (this.play >= this.len) { this.state = "cooldown"; this.cool = params.cooldown[0] * sampleRate; this.tell(); }
      } else if (this.state === "cooldown") {
        if (--this.cool <= 0) { this.state = "idle"; this.len = 0; this.pre.fill(0); this.env = 0; this.tell(); }
      }
    }
    return true;
  }
}
registerProcessor("horror-catch", HorrorCatch);

class HorrorGate extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: "threshold", defaultValue: 0.01, minValue: 0, maxValue: 1, automationRate: "k-rate" }]; }
  constructor() { super(); this.env = 0; this.gain = 0; }
  process(inputs, outputs, params) {
    // Every channel of the mic, summed: on a two-input interface (a Scarlett 2i2) a mic in input 1 or 2 both count.
    const channels = inputs[0] || [];
    const out = outputs[0][0];
    if (!channels.length) { out.fill(0); return true; }
    const threshold = params.threshold[0];
    for (let i = 0; i < out.length; i++) {
      let x = 0;
      for (let c = 0; c < channels.length; c++) x += channels[c][i];
      this.env = Math.max(Math.abs(x), this.env * 0.9995);
      const want = this.env > threshold ? 1 : 0;
      this.gain += (want - this.gain) * (want ? 0.01 : 0.0005);
      out[i] = x * this.gain;
    }
    return true;
  }
}
registerProcessor("horror-gate", HorrorGate);

class HorrorPitch extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: "pitch", defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: "k-rate" }]; }
  constructor() {
    super();
    this.size = 16384;
    this.buf = new Float32Array(this.size);
    this.w = 0;
    this.phase = 0;
    this.win = Math.round(sampleRate * 0.06);
  }
  read(d) {
    let pos = this.w - d;
    while (pos < 0) pos += this.size;
    const i = Math.floor(pos), f = pos - i;
    const a = this.buf[i % this.size], b = this.buf[(i + 1) % this.size];
    return a + (b - a) * f;
  }
  process(inputs, outputs, params) {
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0][0];
    const ratio = params.pitch[0];
    const step = (1 - ratio) / this.win;
    for (let i = 0; i < out.length; i++) {
      const x = input ? input[i] : 0;
      this.buf[this.w] = x;
      if (Math.abs(ratio - 1) < 0.002) {
        out[i] = x;
      } else {
        this.phase += step;
        this.phase -= Math.floor(this.phase);
        const p2 = (this.phase + 0.5) % 1;
        const g1 = Math.sin(Math.PI * this.phase), g2 = Math.sin(Math.PI * p2);
        out[i] = this.read(this.phase * this.win + 2) * g1 * g1 + this.read(p2 * this.win + 2) * g2 * g2;
      }
      this.w = (this.w + 1) % this.size;
    }
    return true;
  }
}
registerProcessor("horror-pitch", HorrorPitch);
`;

function growlCurve(amount) {
  const n = 2048, curve = new Float32Array(n), k = amount * 60;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function noiseBuffer(ctx, seconds, shape = () => 1) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * shape(i / length);
  }
  return buffer;
}

// Start the voice filter on a mic stream. Returns the controls; `stream` is what the recorder adds as its sound.
export async function startVoice(micStream, preset) {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  if (ctx.state === "suspended") await ctx.resume();

  const node = (name) => new AudioWorkletNode(ctx, name, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCountMode: "max" });
  let source = micStream ? ctx.createMediaStreamSource(micStream) : null;
  const catcher = node("horror-catch");
  const gate = node("horror-gate");
  let onCatch = null;
  catcher.port.onmessage = (e) => onCatch?.(e.data);
  const pitchA = node("horror-pitch");
  const pitchB = node("horror-pitch");
  const gainA = ctx.createGain();
  const gainB = ctx.createGain();
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = "highpass";
  const highCut = ctx.createBiquadFilter();
  highCut.type = "lowpass";
  const growl = ctx.createWaveShaper();
  growl.oversample = "4x";
  const growlMakeup = ctx.createGain();
  const wobble = ctx.createGain();
  const wobbleLfo = ctx.createOscillator();
  const wobbleDepth = ctx.createGain();
  wobbleLfo.connect(wobbleDepth).connect(wobble.gain);
  wobbleLfo.start();
  const voiceBus = ctx.createGain();
  const dry = ctx.createGain();
  const echoDelay = ctx.createDelay(2);
  const echoFeedback = ctx.createGain();
  echoFeedback.gain.value = 0.42;
  const echoWet = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = noiseBuffer(ctx, 3.5, (t) => Math.pow(1 - t, 2.6));
  const reverbWet = ctx.createGain();
  const voiceOut = ctx.createGain();
  const mix = ctx.createGain(); // voice + drone + scares: what's heard and recorded
  const liveOut = ctx.createGain();
  liveOut.gain.value = 0;
  const recording = ctx.createMediaStreamDestination();
  const meter = ctx.createAnalyser();
  meter.fftSize = 1024;

  if (source) source.connect(catcher);
  catcher.connect(gate);
  gate.connect(pitchA).connect(gainA).connect(lowCut);
  gate.connect(pitchB).connect(gainB).connect(lowCut);
  lowCut.connect(highCut).connect(growl).connect(growlMakeup).connect(wobble).connect(voiceBus);
  voiceBus.connect(dry).connect(voiceOut);
  voiceBus.connect(echoDelay);
  echoDelay.connect(echoFeedback).connect(echoDelay);
  echoDelay.connect(echoWet).connect(voiceOut);
  voiceBus.connect(reverb).connect(reverbWet).connect(voiceOut);
  voiceOut.connect(meter);
  voiceOut.connect(mix);
  mix.connect(recording);
  mix.connect(liveOut).connect(ctx.destination);

  // The drone under everything: two low saws a half step apart, and wind.
  const drone = ctx.createGain();
  drone.gain.value = 0;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 150;
  droneFilter.Q.value = 5;
  const droneLfo = ctx.createOscillator();
  droneLfo.frequency.value = 0.06;
  const droneLfoDepth = ctx.createGain();
  droneLfoDepth.gain.value = 70;
  droneLfo.connect(droneLfoDepth).connect(droneFilter.frequency);
  droneLfo.start();
  for (const hz of [41.2, 43.65]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = hz;
    osc.connect(droneFilter);
    osc.start();
  }
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer(ctx, 4);
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 380;
  windFilter.Q.value = 0.9;
  const windLfo = ctx.createOscillator();
  windLfo.frequency.value = 0.11;
  const windLfoDepth = ctx.createGain();
  windLfoDepth.gain.value = 220;
  windLfo.connect(windLfoDepth).connect(windFilter.frequency);
  windLfo.start();
  const windGain = ctx.createGain();
  windGain.gain.value = 0.35;
  wind.connect(windFilter).connect(windGain).connect(droneFilter);
  wind.start();
  droneFilter.connect(drone).connect(mix);

  const scareBus = ctx.createGain();
  scareBus.connect(mix);
  scareBus.connect(reverb); // scares ring in the same room as the voice

  const ramp = (param, value) => param.setTargetAtTime(value, ctx.currentTime, 0.04);
  let mode = "live";
  let gateLevel = 0.012;
  let growlAmount = -1;

  function setPreset(p) {
    ramp(pitchA.parameters.get("pitch"), p.pitch);
    ramp(pitchB.parameters.get("pitch"), p.doublePitch);
    ramp(gainA.gain, 1);
    ramp(gainB.gain, p.double);
    ramp(lowCut.frequency, p.lowCut);
    ramp(highCut.frequency, p.highCut);
    if (p.growl !== growlAmount) {
      growlAmount = p.growl;
      growl.curve = growlCurve(p.growl);
    }
    ramp(growlMakeup.gain, 1 - p.growl * 0.5);
    ramp(wobble.gain, 1 - p.wobble);
    ramp(wobbleDepth.gain, p.wobble);
    ramp(wobbleLfo.frequency, Math.max(0.1, p.wobbleHz));
    ramp(echoDelay.delayTime, p.echoTime);
    ramp(echoWet.gain, p.echo);
    ramp(reverbWet.gain, p.reverb * 1.6);
    ramp(dry.gain, 1 - p.reverb * 0.35);
  }
  setPreset(preset);

  // ── The scares: short sounds made here, so there are no files to license. ──
  function env(gainNode, at, peak, attack, decay) {
    gainNode.gain.setValueAtTime(0.0001, at);
    gainNode.gain.exponentialRampToValueAtTime(peak, at + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }
  function thump(at, hz, peak) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(hz * 1.6, at);
    osc.frequency.exponentialRampToValueAtTime(hz, at + 0.08);
    env(g, at, peak, 0.008, 0.28);
    osc.connect(g).connect(scareBus);
    osc.start(at);
    osc.stop(at + 0.4);
  }
  const scares = {
    heartbeat() {
      const t = ctx.currentTime + 0.02;
      for (let beat = 0; beat < 4; beat++) {
        thump(t + beat * 0.85, 52, 0.9);
        thump(t + beat * 0.85 + 0.22, 46, 0.6);
      }
    },
    whispers() {
      const t = ctx.currentTime + 0.02;
      for (let k = 0; k < 7; k++) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx, 0.5, (x) => Math.sin(Math.PI * x) * (0.6 + 0.4 * Math.sin(x * 40)));
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = 1800 + Math.random() * 3500;
        band.Q.value = 6;
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;
        const g = ctx.createGain();
        env(g, t + k * 0.28, 0.5, 0.06, 0.45);
        src.connect(band).connect(pan).connect(g).connect(scareBus);
        src.start(t + k * 0.28);
      }
    },
    stinger() {
      const t = ctx.currentTime + 0.02;
      const g = ctx.createGain();
      env(g, t, 0.35, 0.01, 2.2);
      g.connect(scareBus);
      for (const hz of [196, 207.7, 277.2, 293.7, 392, 415.3]) { // clashing half steps
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = hz;
        osc.frequency.linearRampToValueAtTime(hz * 0.97, t + 2.2);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 2.4);
      }
      const hit = ctx.createBufferSource();
      hit.buffer = noiseBuffer(ctx, 0.6, (x) => Math.pow(1 - x, 4));
      const hg = ctx.createGain();
      hg.gain.value = 0.7;
      hit.connect(hg).connect(scareBus);
      hit.start(t);
    },
    boom() {
      const t = ctx.currentTime + 0.02;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 1.8);
      env(g, t, 1, 0.01, 2.6);
      osc.connect(g).connect(scareBus);
      osc.start(t);
      osc.stop(t + 3);
      const rumble = ctx.createBufferSource();
      rumble.buffer = noiseBuffer(ctx, 2.5, (x) => Math.pow(1 - x, 2));
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 200;
      rumble.connect(lp).connect(scareBus);
      rumble.start(t);
    },
  };

  const levelBuf = new Float32Array(meter.fftSize);

  return {
    context: ctx,
    stream: recording.stream,
    setPreset,
    scare(name) { scares[name]?.(); },
    setAmbience(level) { ramp(drone.gain, level * 0.5); },
    setLive(on, volume = 1) { ramp(liveOut.gain, on ? volume : 0); },
    setGate(threshold) { gateLevel = threshold; ramp(gate.parameters.get("threshold"), mode === "catch" ? 0.001 : threshold); },
    // "live" (straight through) or "catch" (catch a phrase, play it back when you pause). See the top of this file.
    setMode(next) {
      mode = next === "catch" ? "catch" : "live";
      catcher.parameters.get("mode").setValueAtTime(mode === "catch" ? 1 : 0, ctx.currentTime);
      ramp(gate.parameters.get("threshold"), mode === "catch" ? 0.001 : gateLevel); // the phrase is already cleaned up
    },
    setCatch({ threshold, silence, cooldown } = {}) {
      if (threshold != null) catcher.parameters.get("threshold").setValueAtTime(threshold, ctx.currentTime);
      if (silence != null) catcher.parameters.get("silence").setValueAtTime(silence, ctx.currentTime);
      if (cooldown != null) catcher.parameters.get("cooldown").setValueAtTime(cooldown, ctx.currentTime);
    },
    // callback({ state: "idle" | "catching" | "playing" | "cooldown", seconds, dropped? }) on every change.
    onCatch(callback) { onCatch = callback; },
    cancelCatch() { catcher.port.postMessage("cancel"); },
    setVolume(v) { ramp(voiceOut.gain, v); },
    // Switch to another mic without stopping anything else.
    setMic(stream) {
      try { source?.disconnect(); } catch {}
      source = stream ? ctx.createMediaStreamSource(stream) : null;
      source?.connect(catcher);
    },
    level() {
      meter.getFloatTimeDomainData(levelBuf);
      let sum = 0;
      for (const v of levelBuf) sum += v * v;
      return Math.sqrt(sum / levelBuf.length);
    },
    async close() {
      try { source?.disconnect(); } catch {}
      await ctx.close().catch(() => {});
    },
  };
}
