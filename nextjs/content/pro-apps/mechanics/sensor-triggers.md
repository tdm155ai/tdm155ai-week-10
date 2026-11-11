---
title: Sensor triggers
description: The performer fires the cue, not an operator: a spoken word, a raised hand, a box drawn on paper.
---

**The maneuver:** replace the person pressing Go with something that watches or listens. A camera tracks a dancer and the projection follows her; a word in the script triggers a sound; a sensor on the set fires a light. This is the territory of interactive installation and experimental theater, and the part where browser tools are strongest today.

**Where you see it:** Isadora (built for interactive dance and theater: camera tracking actors inside a patch), TouchDesigner (Kinect and lidar installations), Max (pitch and loudness following in music), large immersive works (see [inspiration](/inspiration)).

## Unpacked

1. **Sense:** a camera, a microphone, a sensor.
2. **Extract a signal:** a hand's position, a pose, loudness, a recognized word, a drawn rectangle.
3. **Decide:** a threshold ("hand above the head"), a match ("the word *rose*"), or a model's judgment ("the speaker has moved on to the topic of slide 4").
4. **Debounce:** don't fire the same cue 30 times a second; arm it, fire once, re-arm later.
5. **Fire:** a cue on the stage, or a continuous parameter (the hand's height sets the brightness).

## Build it yourself

- **Hands, faces, poses:** MediaPipe Tasks Vision in the browser (hand landmarker, face landmarker, pose landmarker), no install, runs on a laptop GPU. → [/track](/track)
- **Words:** streaming transcription (OpenAI's realtime transcription, or the browser's `webkitSpeechRecognition` in Chrome for a free, quick version) plus matching against a script. → [/voice](/voice)
- **Drawn shapes:** OpenCV.js contour detection finds rectangles on paper in real time; printed ArUco markers are the rock-solid alternative. → [/draw-a-box](/draw-a-box)
- **Loudness and pitch:** Web Audio `AnalyserNode`.

**Where the pro tool wins:** less than anywhere else. Isadora and TouchDesigner have polished tracking, but MediaPipe in a browser is the same class of model, and Claude can wire it to cues in minutes. The risk is the room: lighting changes break cameras, noise breaks transcription. Rehearse in the space.

**Tool page:** [Isadora](/pro-apps/tools/isadora).
