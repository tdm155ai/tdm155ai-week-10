---
title: "Case study: Sleep No More"
description: Punchdrunk's immersive Macbeth: many rooms, one show clock, and an audience that moves.
---

*Written with AI (Claude), November 11, 2026.* See [the example page](/inspiration/examples/sleep-no-more).

## What we checked

The official teaser from Emursive, its New York producer. **We didn't verify the production's sound or lighting systems**; the table is what a show like this needs.

## The mechanics (our inference)

| Layer | Mechanic |
| --- | --- |
| A show that loops, with scenes in many rooms at the same time | one master clock, many [cue lists](/pro-apps/mechanics/cue-list) |
| Sound and light changing room by room | cues addressed to zones |
| Performers running between floors on schedule | the clock, not an operator, decides |
| The audience choosing where to go | the "camera" is the audience's body: the show has to work from anywhere |

**The lesson:** in an installation-like show, sync matters more than Go. Every room has to know what time it is in the story.

## Build a small version with Claude Code (the studio as the building)

1. **One clock, many rooms.** "Build /rooms: one controller page runs a 3-minute loop; each laptop that opens /rooms/a, /rooms/b, /rooms/c shows that room's cues at the right moment in the loop. Sync over WebSocket (or BroadcastChannel if all the windows are on one computer)."
2. **The audience moves.** "In each room, a webcam with MediaPipe counts people in front of it; if nobody's there, the room dims; when someone arrives, it plays its scene from the current point in the loop."
3. **A whisper.** "When someone stands very close to a laptop, it speaks a line of text-to-speech only they can hear."
