---
title: "Case study: The Eras Tour"
description: "A fixed three-hour stadium show, cued to the music every night. The tools, the mechanics, and a small version you could build."
---

*Written with AI (Claude), November 11, 2026.* See [the example page](/inspiration/examples/eras-tour) for videos.

## Credits we checked

Creative director and production designer Ethan Tobman; production and lighting designer Baz Halpin (Silent House Group, also credited for content); associate lighting designer and programmer Eric Marchwinski (Earlybird Visual); PixMob wristbands. Sources: Wikipedia and OTRA, opened Nov 11, 2026. **We did not verify which console, media server, or playback software the tour used**; the stack below is what a show like this needs, not a credit list.

## The mechanics (our inference)

| Layer of the show | Mechanic | The kind of tool that does it |
| --- | --- | --- |
| Songs in a fixed order, the same every night | [cue list](/pro-apps/mechanics/cue-list) + timecode | a playback rig sends timecode; everything chases it |
| Video on the LED wall and stage floor | [media server](/pro-apps/mechanics/media-server) | a media server cued by timecode |
| Hundreds of lights, a look for every moment | [lighting console](/pro-apps/mechanics/lighting-console) | a console with sequences on timecode, plus live busking |
| 50,000 wristbands changing color | [one cue, many receivers](/inspiration/case-studies/crowd-wristbands) | a broadcast system cued from the show |
| Lifts, pyro, the "dive" into the stage | automation and safety | dedicated systems with human "go" (not something to build) |

**The lesson:** in a show this big and this repeated, almost nothing is "pressed" by a human in real time. The song itself is the clock, and the cues are programmed against it. The humans' job is watching, standing by, and taking over when something goes wrong.

## Build a small version with Claude Code

1. **The song is the clock.** "Read nextjs/lib/stage/README.md. Build a page that plays one audio file from nextjs/public/samples/ and fires cues at times listed in JSON (`{ at: 12.5, cue: {...} }`), reading the audio's `currentTime` each frame. Add a 'record' mode: press the space bar while the song plays and it writes down the times, so I can program cues by tapping along."
2. **Eras as sections.** "Group the cue times into 'eras' with their own color palettes; a section change crossfades the stage to the new palette."
3. **Stand by.** "Show the next three cues with a countdown, like a stage manager's script, and a big red panic button."
