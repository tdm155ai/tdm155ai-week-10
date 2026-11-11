---
title: "Case study: Phish at Sphere"
description: "Visuals improvised live, in a game engine, with a band that never plays the same show twice."
---

*Written with AI (Claude), November 11, 2026.* See [the example page](/inspiration/examples/phish-at-sphere) for videos.

## Credits we checked

Visuals by Moment Factory; real-time content in Unreal Engine (per Unreal Engine's own video on the project). We didn't verify the control surfaces or the rest of the playback chain.

## The mechanics (our inference)

| Layer | Mechanic | How it works |
| --- | --- | --- |
| Visual "worlds" ready to go | [clip launching](/pro-apps/mechanics/clip-launching) | a palette of scenes the operators can call at any moment |
| Following the music | [MIDI control](/pro-apps/mechanics/midi-control), [sensor triggers](/pro-apps/mechanics/sensor-triggers) | operators play controllers; parameters can follow audio |
| Images generated, not played back | [node graph](/pro-apps/mechanics/node-graph) / real-time engine | the picture is computed every frame, so it can change smoothly in any direction |
| A giant curved screen | [media server](/pro-apps/mechanics/media-server) | content rendered for the dome |

**The lesson:** when the performance is improvised, you can't timecode it. You build *instruments* (a set of looks and knobs) and play them live alongside the band. That's the opposite of the [Eras Tour](/inspiration/case-studies/eras-tour), and it's much closer to what you can build today.

## Build a small version with Claude Code

1. **A visual instrument.** "Build a full-screen generative visual in three.js or a fragment shader. Map the Akai MPK's 8 dials (Web MIDI) to speed, color, zoom, and complexity; map the 8 pads to 8 different 'worlds' that crossfade in over a second."
2. **Listen to the band.** "Add microphone input (Web Audio AnalyserNode): bass energy pulses the picture's scale, high frequencies add sparkle. A dial sets how much the audio matters."
3. **Two players.** "Let a second laptop's controller drive half the parameters, over a WebSocket, so two of us can play the visuals together like a band."
