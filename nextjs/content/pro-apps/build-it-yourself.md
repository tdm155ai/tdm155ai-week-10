---
title: Build it yourself
description: The industry-standard app on the left; the browser libraries and strategies you'd use to build the same maneuver with Claude Code on the right.
---

Read across a row: what the pros use, then what you'd reach for to build your own version in a browser with Claude Code. "Ask Claude for" is a phrase you can paste as the start of a prompt. Everything here is free and runs in Chrome; some rows need a tiny Node server, and they say so.

## By mechanic

| Mechanic | Industry standard | Browser libraries and APIs | Strategy | Ask Claude for |
| --- | --- | --- | --- | --- |
| [Cue list](/pro-apps/mechanics/cue-list) | QLab | Web Audio API, Tone.js or Howler.js, `<video>`, keyboard events, BroadcastChannel | Cues as JSON; a playhead index; Go fires and advances; fades as gain ramps | "a QLab-style cue list: JSON cues, space bar is Go, Esc is panic, each cue fires `fireCue`" |
| [Node graph](/pro-apps/mechanics/node-graph) | TouchDesigner, Isadora, Max/MSP | `requestAnimationFrame`, three.js / regl shaders, Hydra, cables.gl; React Flow or Rete.js to draw nodes | Nodes are functions, wires are values passed each frame | "a patch in code: camera → hand tracker → smoothing → `setParam('brightness')`" |
| [Clip launching](/pro-apps/mechanics/clip-launching) | Resolume, Ableton Live | Web MIDI, Tone.js `Transport` for quantized launch, stacked `<video>` with `mix-blend-mode` | A grid of cells, each a cue; launches wait for the next beat | "a 4×4 clip grid mapped to my drum pad, launches quantized to the bar at 120 BPM" |
| [Projection mapping](/pro-apps/mechanics/projection-mapping) | MadMapper, Millumin | CSS `matrix3d`, maptastic, perspective-transform; three.js meshes for curves | Four draggable corners → a homography; calibration saved in localStorage | "warp the stage to four draggable corners, toggle edit mode with M, save it" |
| [Lighting console](/pro-apps/mechanics/lighting-console) | ETC Eos, grandMA3 | Web MIDI for faders; the projector as a light (colored full-screen div); for real fixtures, Web Serial to a USB-DMX box, or Node with `dmx` / `artnet` | A look = an object of levels; a cue crossfades between looks over a time | "a light board: 8 MIDI dials set hue, brightness, and strobe of the stage; record looks as cues with fade times" |
| [Media server](/pro-apps/mechanics/media-server) | disguise, Notch | three.js (previs: stage model, video textures), shaders, Web Audio `AnalyserNode`, WebSockets for multi-machine sync | Model the room first, then put content on it | "a three.js model of our studio with a video playing on the back wall, orbit controls" |
| [MIDI control](/pro-apps/mechanics/midi-control) | every app's MIDI map | Web MIDI API (Chrome/Edge), WebMidi.js | Learn mode: the next message binds to the selected cue | "MIDI learn: click a cue, hit a pad, they're linked; show incoming messages in a log" |
| [Sensor triggers](/pro-apps/mechanics/sensor-triggers) | Isadora, TouchDesigner (+ Kinect) | MediaPipe Tasks Vision; OpenCV.js; js-aruco2; Web Speech API or a realtime transcription API; Web Audio | Sense → signal → decide → debounce → fire | "when my right hand goes above my head, fire cue 3 once; re-arm when it comes down" |
| Timecode / sync | QLab, disguise chasing SMPTE/LTC | an audio track's `currentTime`; WebSockets; OSC through a Node bridge (`osc` or `node-osc`) | One clock everybody reads | "fire these cues at these times in this song" |
| Show control between apps | OSC and MIDI across QLab, Eos, Ableton | BroadcastChannel (tabs on one machine), WebSockets (machines), Web MIDI out | Everything speaks "cue" | "a remote Go button on my phone that fires the laptop's cue list over WebSocket" |

## By app

| App | Build a version today? | The part you can build | The part you can't (yet) |
| --- | --- | --- | --- |
| [QLab](/pro-apps/tools/qlab) | Yes | The cue list, Go, fades, auto-continue, MIDI triggers | Multi-channel audio routing, show-grade reliability, OSC to the lighting desk |
| [TouchDesigner](/pro-apps/tools/touchdesigner) | Partly | A single-purpose patch: tracking → visuals, audio-reactive shaders | The GPU-heavy, all-hardware, everything-at-once studio |
| [Isadora](/pro-apps/tools/isadora) | Yes, for its core use | Camera tracking that drives projection; scenes as cue states | Its polished, non-coder interface |
| [Resolume](/pro-apps/tools/resolume) | Partly | A clip grid on a drum pad with beat-quantized launches | Many HD layers at 60 fps, multi-projector output |
| [MadMapper](/pro-apps/tools/madmapper) | Partly | Four-corner warps for a few surfaces on one projector | Edge blending, many projectors, mesh calibration tools |
| [Millumin](/pro-apps/tools/millumin) | Partly | Timeline + warped layers for one projector | Multi-output theater rigs |
| [Ableton Live](/pro-apps/tools/ableton-live) | Partly | A session grid with quantized loops (Tone.js) | A professional instrument and DAW |
| [Max/MSP](/pro-apps/tools/max) | Partly | Any one patch, written as code | The environment itself, and Max for Live |
| [ETC Eos / grandMA3](/pro-apps/tools/eos-grandma) | No (for real lighting) | Looks and fades on the projector; MIDI faders; a DMX sketch with extra hardware | Hundreds of fixtures, tracking, safety-critical playback |
| [disguise / Notch](/pro-apps/tools/disguise-notch) | No | A three.js previs and generative looks | Synced 4K outputs, timecode, redundancy |

## The honest discussion

Where you win with Claude Code: the thing is *yours*, shaped to one performance, with exactly the triggers you want (a sonnet's words, a hand, a drawn box), free, and running on any laptop with Chrome. You also learn the mechanic, which transfers to every pro tool.

Where the pro tools win: **reliability** (a show runs eight times a week and can't crash), **timing** (sample-accurate audio, frame-accurate video, timecode), **hardware** (DMX universes, multiple projectors, audio interfaces with 16 outputs), **scale**, and **people**: a stage manager or programmer anywhere in the world already knows QLab or Eos. In a professional room, your custom app has to earn its place next to them. A good answer is often both: QLab runs the show, and your browser app sends it a MIDI or OSC message when the dancer raises her hand.
