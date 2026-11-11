---
title: "Mechanics"
description: "The handful of maneuvers every show app is built from, and how to build each one yourself."
---

Every professional show app is a particular arrangement of a few mechanics. Learn the mechanic, and the app becomes one implementation of it among many, including the one you build today with Claude Code.

| Mechanic | The maneuver in one line | Pro apps | Build it here |
| --- | --- | --- | --- |
| [Cue list](/pro-apps/mechanics/cue-list) | Line up everything that happens, then press Go, in order, on time. | QLab, Eos, Millumin | [/launch](/launch) |
| [Node graph](/pro-apps/mechanics/node-graph) | Wire small boxes together so data flows from inputs to outputs. | TouchDesigner, Isadora, Max, Notch | a patch in code |
| [Clip launching](/pro-apps/mechanics/clip-launching) | A grid of clips you fire live, in time with the beat. | Resolume, Ableton Live | [/launch](/launch) |
| [Projection mapping](/pro-apps/mechanics/projection-mapping) | Warp the picture so it lands on a real surface, not a flat screen. | MadMapper, Millumin, disguise | [/stage](/stage) + a warp |
| [Lighting console](/pro-apps/mechanics/lighting-console) | Record looks (levels, colors, positions) as cues and play them back. | ETC Eos, grandMA3 | [/launch](/launch) + MIDI |
| [Media server](/pro-apps/mechanics/media-server) | Play many synced video outputs on a 3D model of the real stage. | disguise, Notch | partly |
| [MIDI control](/pro-apps/mechanics/midi-control) | Physical pads, keys, and dials as a cheap control surface. | every app above | [/launch](/launch) |
| [Sensor triggers](/pro-apps/mechanics/sensor-triggers) | The performer, not an operator, fires the cue: a word, a hand, a drawn box. | Isadora, TouchDesigner | [/voice](/voice), [/track](/track), [/draw-a-box](/draw-a-box) |

All of these fire the same thing in this app: a **cue** on the **stage**, through `fireCue(cue)` in `nextjs/lib/stage/` (see its README). That's the point: once everything speaks "cue", any trigger can drive any output.

For the app-by-app version, see [the tools](/pro-apps/tools); for the library-by-library version, see [Build it yourself](/pro-apps/build-it-yourself).
