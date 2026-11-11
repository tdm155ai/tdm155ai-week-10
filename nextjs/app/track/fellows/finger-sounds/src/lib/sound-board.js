// sound-board.js: holds the sounds and plays them through one volume control.
//
// Browsers only let a page make sound after someone clicks or presses a key,
// so the AudioContext starts on the first click (Start camera, a pad, a key).
// The built-in sounds render as soon as the page loads, so they're ready.
//
// Every sound has a key: a built-in sound's name from sounds.js ("clap"), or
// "file:1", "file:2"… for audio files loaded into the page.

import { SOUNDS, SOUND_IDS, renderSound } from "./sounds.js";

export class SoundBoard {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.8;
    this.buffers = new Map();
    this.fileNames = new Map();
    this.fileCount = 0;
    this.ready = Promise.all(
      SOUND_IDS.map(async (id) => this.buffers.set(id, await renderSound(id))),
    );
  }

  // Starts (or wakes) the audio. Call from a click or key press.
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: "interactive" });
      // A gentle limiter, so many hits at once don't distort.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 6;
      limiter.ratio.value = 10;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.15;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  buffer(key) {
    return this.buffers.get(key);
  }

  label(key) {
    return SOUNDS[key]?.label ?? this.fileNames.get(key) ?? key;
  }

  // Plays a buffer now, or at `when` on the audio clock. Returns the source,
  // so a sound scheduled for later can be cancelled with source.stop().
  play(buffer, when = 0) {
    if (!buffer) return null;
    this.unlock();
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    source.start(when);
    return source;
  }

  // A metronome tick at `when`; higher for the first beat of a bar.
  click(when, accent = false) {
    this.unlock();
    const ctx = this.ctx;
    const tone = ctx.createOscillator();
    tone.frequency.value = accent ? 1760 : 1320;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.22, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    tone.connect(gain).connect(this.master);
    tone.start(when);
    tone.stop(when + 0.06);
    return tone;
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }

  // Reads an audio file (wav, mp3, m4a, ogg…) and returns its new sound key.
  async addFile(file) {
    const data = await file.arrayBuffer();
    const ctx = this.ctx ?? new OfflineAudioContext(1, 1, 48000);
    const buffer = await ctx.decodeAudioData(data);
    const key = `file:${++this.fileCount}`;
    this.buffers.set(key, buffer);
    this.fileNames.set(key, file.name);
    return key;
  }

  close() {
    this.ctx?.close();
    this.ctx = null;
  }
}
