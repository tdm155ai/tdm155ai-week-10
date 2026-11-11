---
title: Millumin
description: Show control and video mapping built for theater and dance, on the Mac. Mechanics: cue list, projection mapping.
---

**What it is:** a show-control and media-server app made for **theater, dance**, video mapping, and installation. A cue-based **dashboard** (layers × columns) plus **timelines** for keyframed animation, with mapping and warping, and MIDI, OSC, and DMX control. Of everything on this list, it's the closest to what runs video in a theater booth. **macOS only** ("There is no version for Windows or Linux"). Maker: the website doesn't name the company on the pages we read (not verified). Mechanics: [cue list](/pro-apps/mechanics/cue-list), [projection mapping](/pro-apps/mechanics/projection-mapping).

**Cost (checked Nov 11, 2026, [millumin.com](https://www.millumin.com/v5/)):** **30-day free trial**, fully unlocked, then a watermark on the output. Rent from US$39; lifetime from US$499.

## The maneuver, unpacked

1. Set the **canvas and output** (e.g. 1920×1080 to the projector); you can program offline.
2. Import media and drop it on the **dashboard**: rows are **layers**, columns are **cues** (states). Clicking a column fires that look, with transitions.
3. **Map and warp** each layer to the set: corner pin or mesh, plus masks.
4. **Animate on a timeline**: keyframe opacity, position, effects.
5. **Run the show** from the keyboard, a MIDI controller, OSC (from QLab, say), or a lighting desk over DMX.

## Watch

- [Millumin Quick Start for Basic Show](https://www.youtube.com/watch?v=tFm5WU8Xem0) (Kevin Ring - Video Tutorials, 14:57): building a project, importing, transitions across columns. (Timestamps not verified.)
- [ART 371 Intro to Millumin part2: Mapping, Masking, Effects & Layer Controls](https://www.youtube.com/watch?v=CU9fkxqoN58) (Coaction Lab, 28:50): a university class recording.
- [[LIVE #09] Animate with the Timeline](https://www.youtube.com/watch?v=sSoNMrkZ8nM) (Millumin, official, 1:05:13). Chapters: 10:07 Animate · 27:26 Asynchronous timelines · 34:38 Tips.

Checked Nov 11, 2026. The official channel has no showreel.

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-dashboard/page.jsx: a
Millumin-style dashboard.
- A grid: 3 layers (rows) x 5 columns (cues). Each cell is optional; a cell holds a
  cue (from nextjs/public/samples/) and a transition time.
- Clicking a column header fires that column: every layer crossfades to its cell's
  media over the transition time. The current column is highlighted.
- Right arrow / left arrow step through columns; space bar = next column.
- Show the result in a preview box and also on the stage (fireCue).
One file.
```

**Could you replace it?** Partly: a dashboard with crossfades and one warped output, yes. Multi-projector theater rigs with DMX and OSC show control, no.
