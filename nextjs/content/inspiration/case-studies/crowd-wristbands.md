---
title: "Case study: The audience as the display"
description: "Coldplay's and Taylor Swift's LED wristbands: one cue fired at 50,000 people."
---

See [Coldplay](/inspiration/examples/coldplay) for videos.

## Credits

PixMob makes LED wristbands used on Coldplay's Music of the Spheres tour and the Eras Tour. The Wall Street Journal's [How Concert LED Wristbands Work](https://www.youtube.com/watch?v=GCsmZA08oD8) (5:29) explains how they're triggered.

## The mechanics

| Layer | Mechanic |
| --- | --- |
| One operator decides "now everyone turns red" | [cue list](/pro-apps/mechanics/cue-list) |
| A transmitter broadcasts the cue to the whole room | one sender, many receivers (the same idea as this app's BroadcastChannel stage) |
| Different sections get different colors | addressing: each receiver knows where it is, so a cue can paint a pattern across the crowd |

**The lesson:** the stage isn't only the stage. A cue can land on thousands of small displays at once, and each person is part of the picture.

## Build a small version with Claude Code (the class as the crowd)

1. **Phones as wristbands.** "Build a page /crowd that goes full-screen black and listens for color cues from a server over WebSocket (or Server-Sent Events). A controller page fires colors and flashes to every connected phone." Everyone in the room opens it on the same Wi-Fi network.
2. **Sections.** "When a phone joins, it picks a seat section (A, B, C) from buttons; cues can target a section, so a wave can travel across the room."
3. **Fire it from the show.** "When a cue fires on the stage, also send it to /crowd, so the whole room changes with the projection."

(This needs a small server running on the class laptop, and phones on the same network: a good stretch goal, not a Hello World.)
