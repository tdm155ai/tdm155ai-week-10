// The piece: Eno-style loops of incommensurate lengths (after Music for Airports), each a single note with long silence
// around it, so the combination never repeats exactly. The room sets each loop's level, brightness, and position.
// Three periods are the ones Eno gave in 1996 (23 1/2, 25 7/8, 29 15/16 s); the others are chosen not to divide them.
// One voice per zone, spaced low → high across the frame (zone 1 lowest), all on one D♭ pentatonic scale. Each zone's
// stinger is a quick three-note figure from its own note upward, played the moment someone enters the zone.

export const VOICES = [
  { id: 'a', note: 'Db3', period: 23.5, offset: 0, kind: 'choir', phrase: ['Db3', 'Eb3', 'Ab3'] },
  { id: 'b', note: 'Ab3', period: 25.875, offset: 3.1, kind: 'piano', phrase: ['Ab3', 'C4', 'Db4'] },
  { id: 'c', note: 'F4', period: 29.9375, offset: 7.4, kind: 'choir', phrase: ['F4', 'Ab4', 'C5'] },
  { id: 'd', note: 'C5', period: 21.3, offset: 11.2, kind: 'piano', phrase: ['C5', 'Db5', 'F5'] },
  { id: 'e', note: 'Ab5', period: 31.7, offset: 5.6, kind: 'choir', phrase: ['Ab5', 'C6', 'Db6'] },
];
const SHIMMER_NOTES = ['Ab5', 'Eb5', 'F5', 'Db6', 'C6', 'Ab4'];
const SHIMMER_PERIOD = 2.9;

// Web Audio's discrete quad order: front left, front right, rear left, rear right. Room x: -1 left … 1 right; y: -1 rear … 1 front.
export const SPEAKERS = {
  2: [{ name: 'L', x: -1, y: 0 }, { name: 'R', x: 1, y: 0 }],
  4: [{ name: 'FL', x: -1, y: 1 }, { name: 'FR', x: 1, y: 1 }, { name: 'RL', x: -1, y: -1 }, { name: 'RR', x: 1, y: -1 }],
};

// Equal-power panning across two (stereo) or four (quad corners) speakers.
export function panGains(n, x, y) {
  const gx = Math.min(1, Math.max(0, (x + 1) / 2)), gy = Math.min(1, Math.max(0, (y + 1) / 2));
  if (n === 4) return [Math.sqrt((1 - gx) * gy), Math.sqrt(gx * gy), Math.sqrt((1 - gx) * (1 - gy)), Math.sqrt(gx * (1 - gy))];
  return [Math.sqrt(1 - gx), Math.sqrt(gx)];
}

// ctx is a native AudioContext, created (and resumed) inside the click that starts the piece.
export async function createScore(ctx) {
  const Tone = await import('tone');
  Tone.setContext(ctx);
  await Tone.start();
  const transport = Tone.getTransport();

  // The output stage: native nodes, so it can be four discrete channels when the device has them.
  const master = ctx.createGain();
  master.gain.value = 0.8;
  let bus = null;
  const strips = []; // every source that pans: { gains: [4 native GainNodes] }
  function buildBus() {
    if (bus) { master.disconnect(); bus.merger.disconnect(); strips.forEach(s => s.gains.forEach(g => g.disconnect())); }
    const n = ctx.destination.maxChannelCount >= 4 ? 4 : 2;
    ctx.destination.channelCount = n;
    ctx.destination.channelCountMode = 'explicit';
    ctx.destination.channelInterpretation = 'discrete';
    const merger = ctx.createChannelMerger(n);
    master.channelCount = n; master.channelCountMode = 'explicit'; master.channelInterpretation = 'discrete';
    merger.connect(master); master.connect(ctx.destination);
    strips.forEach(s => s.gains.forEach((g, k) => { if (k < n) g.connect(merger, 0, k); }));
    bus = { n, merger, max: ctx.destination.maxChannelCount };
    strips.forEach(s => s.pan(s.x, s.y, 0));
  }
  function strip(source, x = 0, y = 0) {
    const gains = [0, 1, 2, 3].map(() => ctx.createGain());
    gains.forEach(g => source.connect(g));
    const s = { gains, x, y, pan(nx, ny, tau = 0.8) {
      s.x = nx; s.y = ny;
      const values = panGains(bus.n, nx, ny);
      gains.forEach((g, k) => tau ? g.gain.setTargetAtTime(values[k] ?? 0, ctx.currentTime, tau) : (g.gain.value = values[k] ?? 0));
    } };
    strips.push(s);
    if (bus) { gains.forEach((g, k) => { if (k < bus.n) g.connect(bus.merger, 0, k); }); s.pan(x, y, 0); }
    return s;
  }
  buildBus();

  // A long, diffuse reverb shared by everything and spread evenly to every speaker.
  const reverb = new Tone.Reverb({ decay: 14, preDelay: 0.2, wet: 1 });
  await reverb.ready;
  const reverbOut = new Tone.Gain(0.55);
  reverb.connect(reverbOut);
  const reverbStrip = strip(reverbOut);
  reverbStrip.gains.forEach(g => (g.gain.value = 0.6));
  reverbStrip.pan = () => {};

  const onsets = VOICES.map(() => -1);
  const voices = VOICES.map((v, i) => {
    const synth = v.kind === 'piano'
      ? new Tone.FMSynth({ harmonicity: 2, modulationIndex: 2.5, envelope: { attack: 0.005, decay: 4, sustain: 0, release: 4 }, modulationEnvelope: { attack: 0.005, decay: 1.5, sustain: 0, release: 2 } })
      : new Tone.Synth({ oscillator: { type: 'fatsine', count: 3, spread: 14 }, envelope: { attack: 3, decay: 1, sustain: 0.7, release: 6 } });
    synth.volume.value = (v.kind === 'piano' ? -8 : -12) - (i === VOICES.length - 1 ? 3 : 0);
    const filter = new Tone.Filter(900, 'lowpass');
    const level = new Tone.Gain(0);
    const send = new Tone.Gain(0.7);
    synth.chain(filter, level);
    level.connect(send); send.connect(reverb);
    const s = strip(level, (i / (VOICES.length - 1)) * 2 - 1, 0);
    // The stinger skips the loop's level, so it is heard at once, and shares the zone's place in the speakers.
    const sting = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3, modulationIndex: 4, envelope: { attack: 0.005, decay: 1.6, sustain: 0, release: 2.5 }, modulationEnvelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 1 } });
    sting.volume.value = -10;
    const stingBus = new Tone.Gain(1);
    sting.connect(stingBus);
    s.gains.forEach(g => stingBus.connect(g));
    stingBus.connect(send);
    const loop = new Tone.Loop(time => {
      synth.triggerAttackRelease(v.note, v.kind === 'piano' ? 0.1 : 5, time, 0.7);
      onsets[i] = time;
    }, v.period).start(v.offset);
    return { ...v, synth, filter, level, strip: s, loop, sting, stingBus, target: 0 };
  });

  // Shimmer: a quick high voice whose level is the room's motion.
  const shimmerSynth = new Tone.Synth({ oscillator: { type: 'fattriangle', count: 2, spread: 10 }, envelope: { attack: 0.4, decay: 1.2, sustain: 0.2, release: 4 } });
  shimmerSynth.volume.value = -14;
  const shimmerLevel = new Tone.Gain(0);
  const shimmerSend = new Tone.Gain(0.9);
  shimmerSynth.connect(shimmerLevel); shimmerLevel.connect(shimmerSend); shimmerSend.connect(reverb);
  const shimmerStrip = strip(shimmerLevel);
  let shimmerStep = 0;
  const shimmerLoop = new Tone.Loop(time => {
    shimmerSynth.triggerAttackRelease(SHIMMER_NOTES[shimmerStep++ % SHIMMER_NOTES.length], 1.5, time, 0.5);
  }, SHIMMER_PERIOD).start(1);

  // Drone: the floor of the room, always there but under the loops (Marlon, 2026-10-22: it was "too loud and dominant";
  // 10 dB down from the first version), a little louder when anyone is. The page's Drone slider trims it (droneTrim).
  const droneFilter = new Tone.Filter(320, 'lowpass');
  const droneLevel = new Tone.Gain(0.05);
  let droneTrim = 1;
  const drones = ['Db2', 'Ab2'].map(n => new Tone.Oscillator({ frequency: n, type: 'sine', volume: -26 }).connect(droneFilter).start());
  droneFilter.connect(droneLevel);
  droneLevel.connect(reverb);
  const droneStrip = strip(droneLevel);

  transport.start();

  const targets = { levels: VOICES.map(() => 0), shimmer: 0, drone: 0.15, brightness: 0, swell: 0 };
  const stung = VOICES.map(() => -1);
  return {
    get channels() { return bus.n; },
    get maxChannels() { return bus.max; },
    targets,
    // Eno mode is slow on purpose: levels glide with a 2.5 s time constant, positions with 0.8 s. Launch mode (fast)
    // rises in about 0.3 s (time constant 0.1) and falls in about 3 s (time constant 1).
    update({ levels, pans, shimmer, shimmerPan, drone, brightness, fast = false, swell = 0 }) {
      const now = ctx.currentTime;
      voices.forEach((v, i) => {
        targets.levels[i] = levels[i];
        const tau = fast ? (levels[i] > v.level.gain.value ? 0.1 : 1) : 2.5;
        v.level.gain.setTargetAtTime(levels[i], now, tau);
        v.filter.frequency.setTargetAtTime(500 + 3500 * Math.min(1, brightness + levels[i] * 0.3), now, 2);
        if (pans?.[i]) v.strip.pan(pans[i].x, pans[i].y);
      });
      targets.shimmer = shimmer; targets.drone = drone; targets.brightness = brightness;
      shimmerLevel.gain.setTargetAtTime(shimmer, now, 1.5);
      if (shimmerPan) shimmerStrip.pan(shimmerPan.x, shimmerPan.y, 0.5);
      droneLevel.gain.setTargetAtTime(drone * droneTrim, now, 3);
      droneFilter.frequency.setTargetAtTime(220 + 500 * brightness, now, 3);
      // Both hands up: the reverb returns louder and longer-sounding across every speaker.
      targets.swell = swell;
      reverbOut.gain.setTargetAtTime(0.55 + 0.75 * swell, now, 0.6);
    },
    // A zone's launch: its three-note figure, now.
    sting(i, velocity = 0.8) {
      const v = voices[i]; if (!v) return;
      const t = Tone.now() + 0.01;
      v.phrase.forEach((n, k) => v.sting.triggerAttackRelease(n, 0.12, t + k * 0.11, velocity * (1 - k * 0.15)));
      stung[i] = Tone.now();
    },
    // Where each loop is in its cycle (0–1), and seconds since it last sounded.
    phases() {
      const t = transport.seconds;
      return VOICES.map((v, i) => ({ phase: t < v.offset ? 0 : ((t - v.offset) % v.period) / v.period, since: onsets[i] < 0 ? null : Tone.now() - onsets[i], stung: stung[i] < 0 ? null : Tone.now() - stung[i] }));
    },
    speakerGains() {
      const out = SPEAKERS[bus.n].map(() => 0);
      const add = (s, lvl) => s.gains.forEach((g, k) => { if (k < bus.n) out[k] += g.gain.value * lvl; });
      voices.forEach((v, i) => add(v.strip, targets.levels[i]));
      add(shimmerStrip, targets.shimmer);
      return out;
    },
    setDrone(v) { droneTrim = v; droneLevel.gain.setTargetAtTime(targets.drone * v, ctx.currentTime, 0.3); },
    setMaster(v) { master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
    async setSink(deviceId) {
      if (!ctx.setSinkId) throw new Error('This browser cannot choose an audio output (no AudioContext.setSinkId).');
      await ctx.setSinkId(deviceId);
      buildBus();
    },
    async dispose() {
      transport.stop(); transport.cancel();
      [...voices.flatMap(v => [v.loop, v.synth, v.filter, v.level, v.sting, v.stingBus]), shimmerLoop, shimmerSynth, shimmerLevel, shimmerSend, reverb, reverbOut, droneFilter, droneLevel, ...drones].forEach(n => n.dispose());
      await ctx.close();
    },
  };
}
