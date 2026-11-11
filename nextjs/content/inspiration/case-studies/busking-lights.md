---
title: "Case study: Busking lights"
description: A lighting director playing the console live, like a member of the band. Jefferson Waful with Umphrey's McGee.
---

*Written with AI (Claude), November 11, 2026.* Video: [Umphrey's McGee: "Der Bluten Kat" w/Jefferson Waful LD Commentary](https://www.youtube.com/watch?v=2aXqNaDIaPY) (Umphrey's McGee, official, 17:28).

## What we checked

The video exists on the band's channel, and Waful is the band's lighting director narrating a real show. We didn't verify which console he uses; watch for it.

## The mechanics

"Busking" means operating lights live, without a fixed cue list, because the band improvises. The programmer prepares in advance:

| Prepared ahead | Fired live |
| --- | --- |
| **Looks** (colors, positions, intensities) stored as presets | which look, when, matched to the music |
| **Effects** (chases, strobes, sweeps) on buttons | stabs and hits on the beat |
| **Faders** for the overall level and each group | the build and the drop |

The console is laid out like an instrument: [lighting console](/pro-apps/mechanics/lighting-console) plus [MIDI control](/pro-apps/mechanics/midi-control).

**The lesson:** preparation and improvisation aren't opposites. You build a palette, then play it.

## Build a small version with Claude Code

1. **A busking board.** "Read nextjs/lib/stage/README.md. Map the Akai MPK: pads 1–4 are color looks (fireCue kind color), pads 5–8 are effects (a strobe, a chase across four colors, a slow pulse, a blackout); dial 1 is the master brightness (setParam). Effects run until I press the pad again."
2. **Tap tempo.** "Add a tap-tempo key; the chase and strobe follow the tapped BPM."
3. **Play to a song.** Put on a track from your group's performance and busk it. Then compare: would this moment have been better as a programmed cue?
