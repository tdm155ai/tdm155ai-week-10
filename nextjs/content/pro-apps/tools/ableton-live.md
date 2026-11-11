---
title: "Ableton Live"
description: "Music software whose Session view is a grid of clips launched live, in time; widely used for theater sound and live looping. Mechanic: clip launching."
---

**What it is:** music software from Ableton (Berlin), Mac and Windows. Its **Session view** is a grid of loops and one-shots you launch live, the direct ancestor of Resolume's clip grid; the **Arrangement view** is a traditional timeline. In theater it runs sound cues and live loops. Current version Live 12 (Live 13 announced for early 2027). Mechanics: [clip launching](/pro-apps/mechanics/clip-launching), [MIDI control](/pro-apps/mechanics/midi-control).

**Cost (checked Nov 11, 2026, [ableton.com/shop](https://www.ableton.com/en/shop/live/)):** Intro $99, Standard $349, Suite $749 (20% off from Nov 10 until Live 13 ships). **[30-day free trial](https://www.ableton.com/en/trial/)** of Suite. **Live Lite** comes free with many controllers: Novation says all its Launchpads include it, so check your controller's box.

## The maneuver, unpacked

1. **Session view:** columns are **tracks**, each cell a **clip slot**. Drag loops and one-shots in.
2. **Launch a clip** with its triangle. Clips loop or play once.
3. **Global Quantization** (e.g. 1 Bar): a launched clip waits for the next bar, so everything stays in time.
4. A horizontal row is a **scene**; its launch button fires the whole row: a section, or a cue.
5. **Hardware:** a Launchpad's 8×8 pads mirror the grid and light up in clip colors. Anything else: **MIDI Map mode** (Cmd/Ctrl-M), click a control, press a pad.
6. **Record** the performance into clips or onto the timeline.

## Watch

- [Learn Live: Session View](https://www.youtube.com/watch?v=qv_N3plJYx4) (Ableton, official, 7:36). ~0:31 loops vs one-shots; **~1:32 Global Quantization**; ~3:00 "a row of clips is called a Scene".
- [Novation // Launchpad With Ableton Live: Super Simple Setup](https://www.youtube.com/watch?v=WDivIS-LI6w) (Novation, official, 0:28): plug in, pick the controller, play.
- [Felix Raphael: Preparing Ableton Session View for Playing Live | incl. LIVE JAM](https://www.youtube.com/watch?v=EidG8BobNS4) (Ableton Tips by PML, 19:46). **11:15 live jam**; 16:10 a live set excerpt.

Checked Nov 11, 2026; timestamps from captions and chapters.

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-session/page.jsx: an Ableton
Session-view grid for sound.
- 4 tracks (columns) x 4 scenes (rows). Each cell is a sound from
  nextjs/public/samples/ (or a Tone.js synth pattern if there aren't enough samples).
- Use Tone.js's Transport at 100 BPM. Clicking a cell launches it at the next bar
  ("@1m"); launching a new cell in a track stops the old one; a scene button
  launches its whole row.
- Map the Akai MPK's 8 pads to the cells with Web MIDI; light the playing cell.
- Each launch also fires a matching color cue on the stage, so the picture changes
  with the music.
```

**Could you replace it?** Partly: a quantized clip grid, yes. A professional instrument and recording studio, no, and if you already have Live Lite from a controller, use it.
