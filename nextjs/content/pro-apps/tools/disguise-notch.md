---
title: disguise and Notch
description: The media server behind most stadium tours (disguise) and the real-time graphics engine that runs inside it (Notch). Mechanic: media server.
---

**What they are:** **disguise** (London) makes the media-server platform used on most stadium tours. Its software, **Designer**, holds a 3D model of the real stage (the **visualiser**), maps content onto every LED screen and projector, and plays a **timeline** cued live or by timecode. Its **RenderStream** brings in real-time engines (Notch, Unreal, TouchDesigner, Unity). **Notch** (UK) is node-graph software for real-time graphics (particles, cloners, simulations); you expose controls and export a **Block** that disguise plays and the operator drives live. Windows. Mechanic: [media server](/pro-apps/mechanics/media-server).

**Cost (checked Nov 11, 2026):**
- disguise Designer **Starter is free** for learning and previs: watermarked, capped at 2K, outputs flash blue, and its projects can't be opened by paid licenses ([comparison](https://www.disguise.one/en/products/designer-starter-vs-pro)). Pro is $159/month or $1,500/year; the servers are hardware.
- Notch: a **60-day trial**; Indie $279/year for hobbyists; VFX and RFX (shows) $1,399–3,780/year ([pricing](https://www.notch.one/pricing)). Playback in a media server needs its own license.

## The maneuver, unpacked

1. **Build the stage:** add LED screens and projectors matching the real set; see it in 3D.
2. **Map outputs:** route each screen to a physical output in the Feed view.
3. **Timeline:** layers of video, generative content, and control (MIDI/DMX); stack effect layers.
4. **Cue it:** cut the timeline into sections; a cue list with a Go button, or chase **timecode**, MIDI, or OSC from lighting.
5. **Real-time content:** a Notch Block on a layer, its exposed parameters (color, speed, intensity) busked live.
6. **Redundancy:** a backup server mirrors the show.

## Watch

- [Behind the scenes of Coldplay's Music of the Spheres World Tour](https://www.youtube.com/watch?v=I7OHTA-N0yM) (Disguise, official, 4:23). ~0:41 the screens (circular IMAG screens, inflatable spheres); **~1:23 at front of house: "we use a fair bit of Notch"**; ~2:01 working with the lighting director; ~3:20 every song stays in the show file as the set list changes.
- [disguise Quick + Basic Setup](https://www.youtube.com/watch?v=_htIo1IKsE8) (Kevin Ring, third-party, 9:00): the maneuver. ~1:00 Stage vs Feed; ~4:30 sections and jumping between cues; ~6:34 the cue list with Go.
- [Case Study: David Guetta's Monolith Show at Stade de France](https://www.youtube.com/watch?v=ogWne32NHqE) (Marketing Disguise, likely official but unconfirmed, 4:35). ~2:41 "a 3D preview of your environment"; ~4:00 visuals following a DJ set that isn't fixed.
- [Notch 2026.1 Release Highlights](https://www.youtube.com/watch?v=fhTpvhzsBnI) (Notch, official, 3:00): what real-time graphics look like now.

Checked Nov 11, 2026; timestamps from captions, approximate.

## Build the maneuver with Claude Code (20 minutes)

```text
Build nextjs/app/my-previs/page.jsx: a disguise-style previsualizer of our studio
with three.js.
- A simple room (floor, back wall, two side walls) with orbit controls.
- A "projection" on the back wall: a plane using a <video> from
  nextjs/public/samples/ as its texture; a second screen on the floor.
- A small panel: buttons switch which sample plays on each surface; a slider
  changes the back-wall screen's size.
- Listen on the stage's BroadcastChannel (see nextjs/lib/stage/README.md) so cues
  fired from /launch also change the back wall in the 3D model.
```

**Could you replace it?** No: synced 4K outputs, timecode, and redundant servers are what tours pay for. But previs in three.js is genuinely how designers sketch a show, and generative looks in shaders are the Notch half in miniature.
