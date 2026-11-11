// Air guitar player: wraps the AirGuitar module (air-guitar.js) so it fits one player's zone.
import { AirGuitar, soundingName } from "../air-guitar.js";

/**
 * `settings` is shared by every guitar: { fretMode, strumHand, capo, lineY, stringsPos, stringsWidth,
 * sensitivity, song }. stringsPos / stringsWidth are relative to the player's own zone.
 */
export class GuitarPlayer {
  constructor(engine, settings, onChange) {
    this.s = settings;
    this.text = ""; this.note = ""; this.active = false; this.flashUntil = 0;
    this.g = new AirGuitar({
      audioContext: engine.ac,
      destination: engine.master,
      onChange: () => onChange?.(this),
      onStrum: () => { this.flashUntil = performance.now() + 160; },
    });
    this.g.ensureAudio();
    this.g.setSong(settings.song);
    this.applySettings([0, 1]);
  }
  get chord() { return this.g.chord; }

  applySettings(zone) {
    const s = this.s, [z0, z1] = zone, w = z1 - z0;
    this.g.set({
      fretMode: s.fretMode, strumHand: s.strumHand, capo: s.capo, lineY: s.lineY, sensitivity: s.sensitivity,
      stringsPos: z0 + s.stringsPos * w, stringsWidth: s.stringsWidth * w, area: [z0, z1],
    });
  }

  update({ hands, now, zone }) {
    this.applySettings(zone);
    this.g.update(hands.map(h => h.lm), now);
    const capo = this.s.capo;
    this.text = hands.length ? "🎸" : "🎸 Show your hands";
    this.note = capo ? `${this.g.chord} → ${soundingName(this.g.chord, capo)}` : this.g.chord;
    this.active = performance.now() < this.flashUntil;
  }

  draw(ctx, W, H, zone, showSkel, now) { this.g.draw(ctx, W, H, now); }
  stop() {}
  dispose() { const o = this.g.output; setTimeout(() => o?.disconnect(), 3000); }
}
