---
title: Clip launching
description: A grid of clips you fire live, in time with the music. How VJs and electronic musicians perform.
---

**The maneuver:** a grid. Each cell holds a clip (a loop of video, a bar of drums). Columns or rows group clips that belong together; fire a whole column and every layer switches at once. Launches snap to the beat, so even a late press lands on time. Unlike a cue list, there is no fixed order: you improvise.

**Where you see it:** Resolume Avenue and Arena (VJ software: layers × columns of video clips), Ableton Live's Session view (tracks × scenes of audio and MIDI clips), Novation Launchpad and Ableton Push (hardware grids that light up to mirror the screen).

## Unpacked

1. **The grid:** layers (rows, stacked top over bottom) × columns (moments). In Ableton it's tracks × scenes.
2. **Fire a clip:** click it or hit its pad; it replaces whatever was playing on that layer.
3. **Fire a column / scene:** every layer changes at once, a whole new look.
4. **Quantize:** the launch waits for the next beat or bar (BPM sync), so it's always on time.
5. **Mix layers:** opacity and blend modes stack video; in Ableton, track volumes mix sound.
6. **Map it to hardware:** a pad grid lights up to show what's playing; dials control effects.

## Build it yourself

- A 4×4 grid of buttons is a 4×4 drum pad. Map pads to cues with the Web MIDI API (`navigator.requestMIDIAccess()` in Chrome; `note on` messages carry the pad number).
- Quantization: Tone.js's `Transport` schedules a callback "at the next bar" (`Tone.getTransport().scheduleOnce(fn, "@1m")`).
- Layers: stack `<video>` elements with CSS opacity and `mix-blend-mode`, or draw them in a canvas.
- Light the pads back: send MIDI note-on to the controller's output (most Launchpads and MPK pads take a velocity as a color or brightness).

**Where the pro tool wins:** Resolume plays many HD layers smoothly on the GPU with effects and outputs to multiple projectors; Ableton's timing is sample-accurate and it is the industry's live-music instrument. A browser grid is a great sketch and a fine class performance.

**Try it:** [/launch](/launch) with a drum pad. Tool pages: [Resolume](/pro-apps/tools/resolume), [Ableton Live](/pro-apps/tools/ableton-live).
