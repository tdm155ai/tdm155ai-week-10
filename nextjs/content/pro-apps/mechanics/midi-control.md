---
title: "MIDI control"
description: "Pads, keys, and dials as a cheap control surface for anything in the browser."
---

**The maneuver:** a MIDI controller sends tiny messages: "pad 36 pressed, velocity 100", "dial 3 moved to 64". Every pro app above lets you **MIDI-map** them: touch a control on screen, touch the pad, and they're linked. A $100 controller becomes a lighting board, a clip launcher, or a Go button.

**What's in the room (Marlon):** 4×4 drum pads, and Akai MPKs (25 keys, 8 pads, 8 dials). "Not as good as a professional lighting board, but for a lot of their small things they don't need something as extreme as a big-theater board."

## Unpacked

1. **Messages:** *note on / note off* (keys and pads: a note number 0–127 and a velocity 0–127) and *control change* (dials and sliders: a controller number and a value 0–127).
2. **Channels:** 16 per cable; most controllers send on channel 1 by default.
3. **Learn mode:** the app waits for the next message and binds it to whatever you selected.
4. **Feedback:** the app can send messages back to light pads.
5. **Clock:** MIDI can carry tempo, so devices stay in time.

## Build it yourself

- Chrome's **Web MIDI API**: `const midi = await navigator.requestMIDIAccess(); midi.inputs.forEach(i => i.onmidimessage = e => console.log(e.data))`. `e.data` is three bytes: status, number, value. That's the whole thing. (WebMidi.js wraps it more readably.)
- A **learn button** is ten lines: set `learning = cueId`, and the next message's note number gets stored for that cue.
- Dials → `setParam(name, value / 127)` from the stage contract.
- Safari doesn't support Web MIDI; use Chrome or Edge.

**Where the pro tool wins:** nowhere special, which is why it's today's cheapest win. MIDI is 40 years old and simple; the browser reads it directly.

**Try it:** [/launch](/launch).
