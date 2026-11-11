// Every node, sequence, and Transport belongs to this page's own Context.
// No shared Tone context or imports from A5.
export async function createAudio() {
  const Tone = await import("tone");
  const context = new Tone.Context({ latencyHint: "interactive", lookAhead: 0.025 });
  await context.resume();
  const limiter = new Tone.Limiter({ context, threshold: -3 }).toDestination();
  const synth = new Tone.PolySynth({ context, voice: Tone.Synth, volume: -15, options: { envelope: { attack: 0.006, decay: 0.12, sustain: 0.15, release: 0.3 } } }).connect(limiter);
  const patternSynth = new Tone.Synth({ context, volume: -20 }).connect(limiter);
  const sequence = new Tone.Sequence({ context, events: ["C3", "E3", "G3", "B3", "G3", "E3", "D3", "G3"], subdivision: "8n", callback: (time, note) => patternSynth.triggerAttackRelease(note, "16n", time) }).start(0);
  context.transport.bpm.value = 104;
  const players = new Map();
  let disposed = false;
  return {
    context,
    async preload(url) {
      if (!url || disposed) return;
      if (!players.has(url)) {
        const player = new Tone.Player({ context, fadeIn: 0.005, fadeOut: 0.025, volume: -8 }).connect(limiter);
        const loading = player.load(url).then(() => player).catch((error) => { player.dispose(); players.delete(url); throw error; });
        players.set(url, { player, loading });
      }
      return players.get(url).loading;
    },
    fire(row, url) {
      if (disposed || context.state !== "running") throw new Error("Enable audio first (or resume it after changing tabs).");
      const time = context.now();
      if (row.action === "clip") {
        const player = players.get(url)?.player;
        if (!player?.loaded) throw new Error("Clip not ready. Assign a file and wait for it to preload.");
        player.loop = Boolean(row.loop);
        if (row.loop && player.state === "started") { player.stop(time); return "loop stopped"; }
        // Player.restart() only acts on an already-started source. start() also
        // restarts active playback, and starts a stopped or freshly loaded clip.
        player.start(time);
        return row.loop ? "loop started" : "clip played";
      }
      if (row.action === "hit") { synth.triggerAttackRelease("C4", "8n", time); return "synth C4"; }
      if (row.action === "chord") { synth.triggerAttackRelease(["C4", "E4", "G4", "B4"], "2n", time); return "Cmaj7 chord"; }
      if (row.action === "pattern") {
        if (context.transport.state === "started") { context.transport.stop(); patternSynth.triggerRelease(); return "pattern stopped"; }
        context.transport.start(time);
        return "pattern started · 104 BPM";
      }
    },
    stop() {
      if (disposed) return;
      context.transport.stop();
      synth.releaseAll();
      patternSynth.triggerRelease();
      for (const { player } of players.values()) if (player.loaded) player.stop();
    },
    dispose() {
      if (disposed) return;
      this.stop();
      disposed = true;
      sequence.dispose();
      for (const { player } of players.values()) player.dispose();
      synth.dispose(); patternSynth.dispose(); limiter.dispose(); context.dispose();
    },
  };
}
