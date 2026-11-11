---
title: Media server
description: Play many synced, high-resolution video outputs, laid out on a 3D model of the real stage. The big-concert tier.
---

**The maneuver:** a stadium show has LED walls, floors, and projections, all different shapes and resolutions. A media server holds a 3D model of the real stage (the **visualizer**), maps content onto every surface, and plays it in sync with the music (often from **timecode**, so video, lights, and pyrotechnics hit the same frame every night). Real-time engines like Notch generate graphics live, reacting to cameras or music.

**Where you see it:** disguise (the standard for major tours and broadcast), Notch (real-time effects that run inside disguise), Unreal Engine on virtual-production LED stages.

## Unpacked

1. **Model the stage:** import the screens and projectors as 3D objects with real sizes and pixel counts.
2. **Previsualize:** see the whole show on the model before load-in.
3. **Timeline:** layers of video and generative content against the song's timeline.
4. **Map:** the server cuts and warps content for each output automatically from the model.
5. **Sync:** chase timecode from the band's playback rig; or cue manually.
6. **Redundancy:** a backup server mirrors everything and takes over instantly if one fails.

## Build it yourself (partly)

- **Previs** is the part you can genuinely build: three.js with a box for the stage, planes for screens, and a `<video>` as a texture on each. Ask Claude for "a 3D model of our studio with a projection on the back wall, orbit controls".
- **Generative content:** shaders (three.js, Hydra) that react to audio (Web Audio `AnalyserNode`) or tracking.
- **Sync across machines:** BroadcastChannel only works between tabs on one computer; for several laptops, a small WebSocket server.
- **Timecode:** read a cue time from an audio track's `currentTime` and fire events on schedule.

**Where the pro tool wins:** almost everywhere. 4K-per-output playback across dozens of outputs, genlock, frame-accurate timecode, redundancy, and a team of specialists. The class version is a previs sketch and a generative look, which is where real designers start too.

**Tool page:** [disguise and Notch](/pro-apps/tools/disguise-notch). Case studies: [inspiration](/inspiration/case-studies).
