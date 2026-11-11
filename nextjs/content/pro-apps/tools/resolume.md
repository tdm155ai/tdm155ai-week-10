---
title: "Resolume"
description: "VJ software from the Netherlands: a grid of video clips triggered live, in time with the music, mapped onto screens. Mechanics: clip launching, projection mapping."
---

**What it is:** live video ("VJ") software. Video loops, stills, cameras and generators sit in a grid; you trigger them live, stack them with blend modes and effects, sync them to the BPM, and send the result to projectors or LED walls. **Avenue** is the performance edition; **Arena** adds projection mapping, edge blending, and DMX. Mac and Windows. Mechanics: [clip launching](/pro-apps/mechanics/clip-launching), [projection mapping](/pro-apps/mechanics/projection-mapping).

**Cost (checked Nov 11, 2026, [resolume.com/shop](https://resolume.com/shop)):** Avenue €299, Arena €799; 50% education discount. **Free demo, unlimited:** "Everything works. You can save and use all the features. The only limitation is a visual watermark … Also, a robotic voice will remind you every once in a while." ([source](https://resolume.com/support/en/avenue-arena-difference))

## The maneuver, unpacked

1. The grid: horizontal **layers** × vertical **columns**; each cell is a **clip**. Sets of clips live in **decks**.
2. **Click a clip** to play it on its layer (one clip per layer at a time). Layers stack top over bottom; each layer's V slider is its opacity.
3. **Click a column** to fire every clip in it at once: a whole new look in one move.
4. Add **effects** to a clip, layer, or the whole composition.
5. **BPM sync:** tap the tempo; clips and effects follow it.
6. **MIDI map:** enter mapping mode, click a button or slider, touch a pad or fader.
7. **Output:** full screen to a display; or **Advanced Output** to cut the picture into **slices** for each physical screen, with masks (warping and edge blending are Arena only).

## Watch

- [Resolume Video Training: 1.2 Triggering a Clip](https://www.youtube.com/watch?v=boSVYqRVD7Y) (Resolume, official, 1:26): the core action, nothing else. Same series: [4.2 BPM Sync](https://www.youtube.com/watch?v=LgInkPpePc4) (2:53) and [6.2 MIDI Controllers](https://www.youtube.com/watch?v=vVIeuXvbQGI) (4:55) (these two confirmed from search listings).
- [Resolume Quick Start Guide | How to VJ - Beginner Tutorial](https://www.youtube.com/watch?v=U-oZYkVO4wM) (Sean Bowes, 24:21). ~4:30 decks, layers vs columns; ~11:30 opacity and **column buttons**; ~21:30 output to a second display.
- [Resolume Advanced Output | LED Screen Mapping | Quick Start Tutorial](https://www.youtube.com/watch?v=_GMVDozQM2k) (Sean Bowes, 15:06). ~2:00 slices; ~11:00 masks for curved screens.

Checked Nov 11, 2026; timestamps from transcripts, approximate.

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-vj/page.jsx: a Resolume-style
clip grid.
- A 4x4 grid of cells (rows = layers, columns = looks), each a cue from a JSON array
  using the samples in nextjs/public/samples/. Click a cell to fire it; a column
  header button fires every cell in that column.
- Web MIDI: map a 4x4 drum pad so each pad fires one cell. Add a "learn" button:
  click a cell, hit a pad, they're linked. Show incoming MIDI messages in a log.
- A BPM box with a tap-tempo button; when "quantize" is on, a pressed cell waits
  for the next beat before it fires.
- A MIDI dial sets setParam("opacity", value / 127).
One file, please.
```

**Could you replace it?** Partly: the grid, the pads, and quantized launches, yes. Many HD layers at 60 fps with effects on several projectors, no. Its free watermarked demo is a good way to learn the real thing.
