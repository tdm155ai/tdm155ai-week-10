---
title: "Isadora"
description: "TroikaTronix's patching-and-cueing app built for theater and dance. Mechanics: node graph, cue list, sensor triggers."
---

**What it is:** a node-based media server and cueing tool made for theater, dance, and installation. You build **scenes** out of **actors** wired together, then step through the scenes like cues. It sits between QLab (scenes + space bar) and TouchDesigner (patching), and it's built for interactive, sensor-driven performance. Made by TroikaTronix (created by Mark Coniglio). Mac and Windows; one license runs on both. Mechanics: [node graph](/pro-apps/mechanics/node-graph), [cue list](/pro-apps/mechanics/cue-list), [sensor triggers](/pro-apps/mechanics/sensor-triggers).

**Cost** ([TroikaTronix pricing](https://support.troikatronix.com/support/solutions/articles/13000106528)): **free demo: everything works except saving.** $199/year; rentals $17.50 for 7 days or $30 for 30; perpetual $725. Academic discounts 30% (institutions, faculty) and 50% (students), not on rentals.

## The maneuver, unpacked

1. Drag media into the **Media** bin; Isadora numbers each file.
2. In the scene editor, add **actors**: a **Movie Player** (plays media number N) and a **Projector** (sends video to the stage).
3. **Patch:** drag from the Movie Player's video output to the Projector's input. The wire turns green when data flows. Inputs are on the left of each actor, outputs on the right.
4. Preview: Output → Show Stage (or Force Stage Preview).
5. Make more **scenes**: drag media into the Scene List and each gets a patched player and projector. Scenes carry cue numbers for the stage manager.
6. Run it: **space bar** goes to the next scene; a per-scene **fade time** makes a crossfade; a **Jump** actor fired by an event (a movie ending, a Comparator watching playback) makes an auto-follow; **Enter Scene Trigger** fires things on arrival.

## Watch

All three from the official troikatronix channel ("Isadora 101", made for Isadora 3; the current version is 4):

- [Isadora 101 - #1: How to Build Your First Isadora Patch](https://www.youtube.com/watch?v=2IOoTTQ9d94) (13:13). ~5:00 add a Movie Player; ~8:00 the Projector; ~9:30 patch the wire, red to green.
- [Isadora 101 - #2: Building Scene Transitions & Cues](https://www.youtube.com/watch?v=LUX28Js6wEk) (21:58). ~4:30 space bar fires the next scene; ~6:30 crossfade time; ~14:00 cue numbering for the stage manager; ~16:30 auto-follow with a Jump actor.
- [Isadora and IzzyCast Demo - Prolight + Sound 2023](https://www.youtube.com/watch?v=mObxmEInPqc) (8:20): an overview demo (content not reviewed).

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-scenes/page.jsx: Isadora-style
scenes where the performer, not the operator, can advance the show.
- Scenes are a JSON array: name, a cue to fire on entry (fireCue), a fade time, and
  an optional "jump when" rule: { after: seconds } or { onKey: "j" }.
- Space bar goes to the next scene; show the scene list with the current one lit.
- Add a sensor rule: { onLoud: 0.6 } jumps to the next scene when the microphone's
  loudness (Web Audio AnalyserNode) crosses 0.6, then waits 2 seconds before it can
  fire again (debounce). Show a live loudness meter.
Keep it one file.
```

**Could you replace it?** For its core use (camera or mic drives the projection; scenes as cues), yes, and today's [/track](/track) and [/voice](/voice) are versions of it. What you lose is its polished, no-code interface for designers.
