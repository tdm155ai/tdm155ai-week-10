---
title: "MadMapper"
description: "Projection-mapping (and LED-mapping) software: draw a surface, warp it onto the real object, assign media. Mechanic: projection mapping."
---

**What it is:** projection-mapping and LED/DMX light-mapping software, a collaboration between the French installation studio 1024 architecture and the Swiss developers GarageCube. You draw surfaces that match real objects, warp them until they line up, and give each its own media; it also has cues, a timeline, lasers, and 3D calibration. Mac and Windows; current version MadMapper 6. Mechanic: [projection mapping](/pro-apps/mechanics/projection-mapping).

**Cost (checked Nov 11, 2026, [madmapper.com](https://madmapper.com/madmapper/software)):** **free to try, every feature, no time limit**, with a watermarked output (and DMX blacking out every 30 seconds). Rent from €44/month; buy from €479.

## The maneuver, unpacked

1. Point the projector at the object and show a **test card**.
2. Create a surface, usually a **Quad** (also triangles, circles, mesh, bezier).
3. **Warp:** drag the quad's four corners onto the object's corners. Curved things get **mesh warping**.
4. **Mask** (quad or bezier) what shouldn't be lit.
5. **Assign media** (video, image, live input, generator) to each surface; the input view sets which part of the media lands there.
6. Repeat for each face, wall, or projector.
7. Sequence it with **cues** or a **timeline**.

## Watch

- [Quad Creation — MADTutorial Basics](https://www.youtube.com/watch?v=Lrf3lO9vsCs) (MadMapper, official, 1:56): the whole maneuver in two minutes (2017 interface). Companion: [Quad Mask](https://www.youtube.com/watch?v=tJzjmDEilUk) (1:56, confirmed from search listing).
- [MadMapper House Projection Mapping Walkthrough](https://www.youtube.com/watch?v=YVgUWpfaRNU) (Luma Box, 23:03): a real Halloween house. Chapters: 03:45 Input · 05:49 Masking · 14:07 two projectors · 16:44 Mapping.
- [MadMapper Artists Showreel](https://www.youtube.com/watch?v=6WwWu8i2bCg) (MadMapper, official, 2:28, Nov 2025): 1024 architecture in Lyon at 00:00; the reopening of Notre-Dame de Paris at 00:31; the Eiffel Tower at 02:20.

Checked Nov 11, 2026 against YouTube's metadata.

## Build the maneuver with Claude Code (20 minutes)

```text
Read nextjs/lib/stage/README.md. Build nextjs/app/my-map/page.jsx: a full-screen
projection-mapping page for one projector.
- Two surfaces, each a <div> holding a video from nextjs/public/samples/.
- Press M for edit mode: each surface shows four draggable corner handles; dragging
  warps it with a CSS matrix3d perspective transform computed from the four corners
  (write the homography math or use the perspective-transform package).
- Show a test grid in edit mode; save the corners to localStorage.
- Press 1 or 2 to swap which sample plays on each surface.
- F toggles full screen.
Then I'll put it on the little projector and drag the corners onto a box.
```

**Could you replace it?** Partly. Four-corner warps for a few surfaces on one projector, yes, and that's what the class's little projectors need. Edge blending, many projectors, and mesh calibration tools, no.
