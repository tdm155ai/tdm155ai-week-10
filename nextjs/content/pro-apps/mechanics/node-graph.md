---
title: "Node graph"
description: "Wire small boxes together so data flows from inputs (camera, mic, MIDI) to outputs (picture, sound, light)."
---

**The maneuver:** instead of writing code top to bottom, you place boxes (operators, actors, objects, nodes) on a canvas and draw wires between them. A camera box feeds a blur box feeds the output. Change a number on any box and the result changes live. It's programming you can see.

**Where you see it:** TouchDesigner (operators, in families: TOPs for images, CHOPs for numbers and signals, SOPs for 3D geometry, DATs for text and tables), Isadora (actors in scenes), Max/MSP (objects joined by patch cords), Notch, Blender's shader nodes, Unreal's Blueprints.

## Unpacked

1. **A node** does one thing: read the webcam, measure loudness, add two numbers, draw a circle.
2. **Wires** carry data: images, numbers changing over time, events ("bang"), text.
3. **Inputs to outputs:** sensors and media on one side, a projector or speakers on the other.
4. **Parameters** on each node can be set by hand or driven by another wire (the hand's height drives the brightness).
5. **It's live:** the graph runs while you edit it. That's why performers love it: you tune it in the room.
6. **Scenes or containers** group a graph so a show can switch from one patch to the next.

## Build it yourself

You don't need a visual editor to get the idea: a node is a function, and a wire is a variable passed from one to the next, once per animation frame. Ask Claude for "a small patch in code": `camera → hand tracker → y position → smoothing → setParam("brightness", y)`.

- Real-time loop: `requestAnimationFrame`.
- Signals and smoothing: a few lines (`smoothed += (target - smoothed) * 0.1`).
- If you want the boxes and wires on screen: React Flow or Rete.js draw node editors; cables.gl is a whole browser-based node environment (worth a look as a free "TouchDesigner in a tab").
- Picture effects: WebGL shaders through three.js or regl; or Hydra, a browser live-coding video synth whose chained functions (`osc().kaleid().out()`) read like a node graph in one line.

**Where the pro tool wins:** TouchDesigner and Notch run on a GPU at 60 fps with thousands of nodes, read every kind of hardware (Kinect, lidar, DMX, NDI video over the network), and have a decade of community tutorials. What you build with Claude is a single-purpose patch; theirs is a whole studio.

**Try it:** [/track](/track) is a node graph in disguise (camera → MediaPipe → numbers → stage). Tool pages: [TouchDesigner](/pro-apps/tools/touchdesigner), [Isadora](/pro-apps/tools/isadora), [Max](/pro-apps/tools/max).
