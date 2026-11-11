---
title: "Case study: AURA"
description: "Moment Factory's projection-mapped show in Montreal's Notre-Dame Basilica. Architecture as the screen."
---

See [the example page](/inspiration/examples/aura) for videos.

## Credits

Moment Factory, in Notre-Dame Basilica, Montreal; the official teaser and making-of are on their channel.

## The mechanics

| Layer | Mechanic |
| --- | --- |
| Images that fit the arches, ribs, and altar | [projection mapping](/pro-apps/mechanics/projection-mapping), from a 3D model of the interior |
| A fixed show set to an orchestral score | [cue list](/pro-apps/mechanics/cue-list) + timecode |
| Many projectors covering one huge space | [media server](/pro-apps/mechanics/media-server), edge blending |
| Lighting fixtures working with the projection | [lighting console](/pro-apps/mechanics/lighting-console) |

**The lesson:** the content is drawn *for* the architecture. A pattern that follows a rib looks like the building is glowing; the same pattern on a flat wall is just video.

## Build a small version with Claude Code (with the little projectors)

1. **Map a box.** Use the [MadMapper prompt](/pro-apps/tools/madmapper): warp two surfaces onto two faces of a cardboard box.
2. **Draw for the shape.** "On each mapped face, draw a generative pattern that follows the edges: lines that run along the border and pulse inward, so the box looks lit from inside."
3. **Make it a show.** "Sequence three looks to a piece of music, using the cue-times-from-the-song approach in the [Eras Tour case study](/inspiration/case-studies/eras-tour)."
