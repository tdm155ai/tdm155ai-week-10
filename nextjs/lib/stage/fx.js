// The stage's effects: a DJ filter and an echo that every stage sound (and unmuted video) runs through, played like a
// Kaoss pad from /launch/xy, a MIDI knob, or a hand. Controlled with setParam (lib/stage/stage.js), each 0–1:
//
//   filter     0.5 = off. Below: a low-pass sweeps down (muffled, bass only). Above: a high-pass sweeps up (thin).
//   resonance  how much the filter rings at its cutoff (0 = smooth, 1 = whistling).
//   echo       how much echo: 0 = none, 1 = a lot (long feedback).
//   echoTime   the gap between echoes: 0 = 40 ms (a buzz), 1 = 1 s.
//
// Built with the browser's Web Audio nodes: BiquadFilterNode (filter) and DelayNode + GainNode (echo).

export const FX_PARAMS = ["filter", "resonance", "echo", "echoTime"];

const LOWEST = 60, HIGHEST = 20000; // Hz

// Positions on a log scale, the way ears hear pitch: 0 → from, 1 → to.
const logScale = (t, from, to) => from * (to / from) ** t;

// What the filter is doing, in words: "off", "low-pass 800 Hz", "high-pass 2.1 kHz".
export function describeFilter(f) {
  if (Math.abs(f - 0.5) < 0.02) return "off";
  const hzText = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`);
  return f < 0.5 ? `low-pass ${hzText(logScale(f / 0.5, LOWEST * 2, HIGHEST))}` : `high-pass ${hzText(logScale((f - 0.5) / 0.5, 20, 8000))}`;
}

export function createFx(ctx, destination = ctx.destination) {
  const input = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const dry = ctx.createGain();
  const delay = ctx.createDelay(2);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();
  const output = ctx.createGain();

  // input → filter → output, and filter → delay ⟲ feedback → wet → output
  input.connect(filter);
  filter.connect(dry).connect(output);
  filter.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(output);
  output.connect(destination);

  filter.type = "lowpass";
  filter.frequency.value = HIGHEST;
  filter.Q.value = 0.7;
  delay.delayTime.value = 0.35;
  feedback.gain.value = 0;
  wet.gain.value = 0;

  const state = { filter: 0.5, resonance: 0, echo: 0, echoTime: 0.4 };
  const glide = (param, value, seconds = 0.03) => param.setTargetAtTime(value, ctx.currentTime, seconds); // no clicks

  const applyFilter = () => {
    const f = state.filter;
    const q = 0.7 + state.resonance * 13; // past ~14 it screams
    if (Math.abs(f - 0.5) < 0.02) { filter.type = "lowpass"; glide(filter.frequency, HIGHEST); glide(filter.Q, 0.7); return; }
    if (f < 0.5) { filter.type = "lowpass"; glide(filter.frequency, logScale(f / 0.5, LOWEST * 2, HIGHEST)); }
    else { filter.type = "highpass"; glide(filter.frequency, logScale((f - 0.5) / 0.5, 20, 8000)); }
    glide(filter.Q, q);
  };

  return {
    input,
    set(name, value) {
      if (!(name in state)) return;
      state[name] = value;
      if (name === "filter" || name === "resonance") applyFilter();
      if (name === "echo") { glide(feedback.gain, value * 0.85); glide(wet.gain, Math.min(0.7, value * 1.2)); }
      if (name === "echoTime") glide(delay.delayTime, logScale(value, 0.04, 1), 0.08);
    },
    state,
  };
}
