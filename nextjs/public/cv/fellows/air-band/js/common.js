// Shared bits for every instrument: note helpers, the band's audio engine, drawing helpers.

export const NAMES = ["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];
export const noteName = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// Real trumpet recordings: tonejs-instruments sample set by Nicholaus Brosowsky (CC-BY 3.0)
export const TRUMPET_SAMPLES = { base: "samples/trumpet/", notes: [
  ["F3",53],["A3",57],["C4",60],["Ds4",63],["F4",65],["G4",67],["As4",70],["D5",74],["F5",77],["A5",81],["C6",84]] };
// Salamander Grand Piano recordings by Alexander Holm (CC-BY 3.0)
export const PIANO_SAMPLES = { base: "samples/piano/", notes: [
  ["A2",45],["C3",48],["Ds3",51],["Fs3",54],["A3",57],["C4",60],["Ds4",63],["Fs4",66],
  ["A4",69],["C5",72],["Ds5",75],["Fs5",78],["A5",81],["C6",84],["Ds6",87],["Fs6",90],["A6",93]] };

/** The closest recorded note to `midi` in a loaded bank. */
export const nearest = (bank, midi) => bank.reduce((a, b) => Math.abs(b.m - midi) < Math.abs(a.m - midi) ? b : a);

/** One AudioContext + master volume + reverb, shared by every player's instrument. */
export class Engine {
  constructor() {
    const ac = this.ac = new AudioContext();
    this.master = ac.createGain(); this.master.gain.value = 0.7;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    // band-wide DJ filter (fully open = no effect); the filter player sweeps these
    this.hp = ac.createBiquadFilter(); this.hp.type = "highpass"; this.hp.frequency.value = 20; this.hp.Q.value = 0.7;
    this.lp = ac.createBiquadFilter(); this.lp.type = "lowpass"; this.lp.frequency.value = 20000; this.lp.Q.value = 0.7;
    this.master.connect(this.hp).connect(this.lp).connect(comp).connect(ac.destination);
    this.rev = ac.createConvolver(); this.rev.buffer = this.impulse(1.8, 3);
    const wet = ac.createGain(); wet.gain.value = 0.22;
    this.rev.connect(wet).connect(this.master);
    this.banks = {}; // name -> [{ m, b }] once loaded
  }
  impulse(sec, decay) {
    const ac = this.ac, len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }
  setVolume(v) { this.master.gain.setTargetAtTime(v, this.ac.currentTime, 0.05); }
  /** A gain node feeding the master (and the reverb by `send`). */
  bus(level = 1, send = 1) {
    const g = this.ac.createGain(); g.gain.value = level; g.connect(this.master);
    const s = this.ac.createGain(); s.gain.value = send; g.connect(s).connect(this.rev);
    return g;
  }
  /** Load a set of recordings once; every player shares the decoded audio. */
  async loadBank(name, { base, notes }) {
    const list = await Promise.all(notes.map(async ([file, m]) => {
      const res = await fetch(base + file + ".mp3");
      if (!res.ok) throw new Error(`${name} ${file}: ${res.status}`);
      return { m, b: await this.ac.decodeAudioData(await res.arrayBuffer()) };
    }));
    this.banks[name] = list;
    return list;
  }
}

export const HAND_LINKS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export function drawHand(ctx, h, color, width = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  for (const [a, b] of HAND_LINKS) {
    ctx.beginPath(); ctx.moveTo(h[a].x, h[a].y); ctx.lineTo(h[b].x, h[b].y); ctx.stroke();
  }
}

/** The canvas is mirrored with CSS; this draws text that still reads the right way round. */
export function label(ctx, text, x, y, color, font) {
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
  ctx.fillStyle = color; ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0); ctx.restore();
}

export const GOLD = "#e8b04a";
