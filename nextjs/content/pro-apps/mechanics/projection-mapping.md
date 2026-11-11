---
title: "Projection mapping"
description: "Warp the picture so it lands on a real object (a wall, a box, a set piece) instead of a flat screen."
---

**The maneuver:** the projector throws a rectangle; the world is not a rectangle. Mapping software lets you grab the corners of the picture and drag them until they sit on the edges of the real surface, cut away what shouldn't be lit with masks, and give each surface its own content.

**Where you see it:** MadMapper and Millumin (theater and installation standards), Resolume Arena's Advanced Output, disguise (at concert scale, from a 3D model of the stage), building-scale shows (see [inspiration](/inspiration)).

## Unpacked

1. **Point the projector** at the object; output a test grid full screen.
2. **Make a surface** (a quad) for each face of the object.
3. **Warp:** drag the four corners to the object's corners. The picture is pre-distorted so it looks right on the real thing. For curved things, use a mesh with more points.
4. **Mask** what shouldn't get light (the floor, the actor's face).
5. **Assign media** to each surface: one video on the box's front, another on its side.
6. **Save the calibration.** If the projector gets bumped, you redo step 3.

## Build it yourself

- The core is one CSS property: `transform: matrix3d(...)` computed from four dragged corners (a "perspective transform" or homography). Ask Claude for "a full-screen page with four draggable corner handles that warps a video to fit, saved to localStorage, toggled with M". The maptastic library does exactly this; the perspective-transform package does the math.
- For meshes and curved surfaces: three.js, a plane with many vertices you can drag.
- Masks: an SVG or canvas polygon in black over the picture.
- Multiple surfaces: several warped `<div>`s in the same full-screen stage window.

**Where the pro tool wins:** soft-edge blending across several projectors, 3D-model-based alignment, a hundred surfaces, guaranteed frame rate, and output to many projectors from one machine. A browser warp handles one projector and a few surfaces, which is exactly the class's little projectors.

**Try it:** [/stage](/stage) on the projector. Tool pages: [MadMapper](/pro-apps/tools/madmapper), [Millumin](/pro-apps/tools/millumin).
