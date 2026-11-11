---
title: "Sensors and gestures"
description: "Motion detection, markerless mocap, MediaPipe, and gesture gloves."
order: 4
---

*Researched with AI for this class and checked on the morning of November 11, 2026 (title, channel, length, date, and embed status read from each YouTube page). **watched** means the moment was seen on screen at that timestamp; **metadata only** means the timestamp is a description chapter or a rough pointer. Credits come from the linked press or studio pages; anything not confirmed is marked **unverified**. Where a "build a tiny version" idea needs something this app doesn't do yet (a webcam layer on the stage, pitch tracking, a timeline), it's a prompt for Claude Code, not a feature.*

**Best 2:** pwnisher's motion-detected music, Gibson/Martelli with live mocap.

## pwnisher: making music from motion-detected video in TouchDesigner

- **Video:** [Make Music with Motion Detected Visuals | Touch Designer Tutorial](https://www.youtube.com/watch?v=td5ZYosA2WM) (pwnisher, 43:50, 2026-11-07; creator, posted November 7)
- **Watch at:** 10:59 "Motion Detection (pt.1)". TouchDesigner network beside the source footage (watched); 36:55 "Final Performance" (chapter)
- **Mechanic:** sensors/gestures, rig explainer
- **Why it's here:** A huge creator, posted this week, doing exactly our [/track](/track) idea.
- **Build a tiny version:** [/track](/track). Hand height = pitch, brightness = volume.
- **Credits and sources:** description ("brighter the image, the louder the sound").

![youtube: Make Music with Motion Detected Visuals | Touch Designer Tutorial (pwnisher, 43:50)](https://www.youtube.com/watch?v=td5ZYosA2WM)

## Gibson/Martelli: dancers with real-time markerless motion capture

- **Video:** [Dancing with AI: Real-time Motion Capture Meets Live Performance | Gibson/Martelli x RADiCAL](https://www.youtube.com/watch?v=lEaHx8Ou2CI) (RADiCAL, 2:29, 2025-06-06; manufacturer)
- **Watch at:** metadata only
- **Mechanic:** sensors, dance tech
- **Why it's here:** Webcam-style body tracking (no suit) in a real theater.
- **Build a tiny version:** [/track](/track). Pose landmarks drive a projected avatar.
- **Credits and sources:** The description says it was developed during "a MODINA.eu residency at Budapest's Trafó."

## kristaps kazaks: a body as 250,000 points (Kinect + TouchDesigner)

- **Video:** [self, 2023 (TouchDesigner + Kinect)](https://www.youtube.com/watch?v=OndaS-HD7dc) (kristaps kazaks, 2:44, posted 2024-01-02; creator)
- **Watch at:** metadata only
- **Mechanic:** sensors (a depth camera), generative graphics, MIDI and audio control
- **Why it's here:** the depth camera's points become the picture itself, not a trigger: the point cloud is the output.
- **Build a tiny version:** [/launch/particles](/launch/particles) moved by your palm, or the 21 hand points on [/track](/track); a webcam has no depth, so MediaPipe's points stand in for the Kinect's.
- **Credits and sources:** the creator's description: "250k points in real-time from Kinect camera into TouchDesigner controlled with midi and audio via custom setup." Music: Caribou, "Can't Do Without You" (Tale of Us & Mano le Tough remix). The patch itself isn't shown or explained.

![youtube: self, 2023 (TouchDesigner + Kinect) (kristaps kazaks, 2:44)](https://www.youtube.com/watch?v=OndaS-HD7dc)

## MediaPipe face tracking in TouchDesigner

- **Video:** [MediaPipe Face Tracking in TouchDesigner](https://www.youtube.com/watch?v=2A16TuIpBVI) (The Interactive & Immersive HQ, 23:18, 2026-04-27; educator)
- **Watch at:** metadata only
- **Mechanic:** sensors, rig explainer
- **Why it's here:** The same MediaPipe we use, in the pro tool.
- **Build a tiny version:** [/track](/track). Add a face mode where an open mouth fires a cue.
- **Credits and sources:** description.

## Imogen Heap: MiMU gloves (older classic)

- **Video:** [Sculpting music with Mi.Mu gloves | Imogen Heap | TEDxCERN](https://www.youtube.com/watch?v=7oeEQhOmGpg) (TEDx Talks, 17:23, 2015-12-07; official)
- **Watch at:** metadata only
- **Mechanic:** sensors/gestures
- **Why it's here:** Still the best demo of gesture as instrument. Older; nothing newer shows it as clearly.
- **Build a tiny version:** [/track](/track). A fist closes a filter, and an open palm releases it.
- **Credits and sources:** TEDx description. Ariana Grande used the gloves on her 2015 Honeymoon Tour: [fan video](https://www.youtube.com/watch?v=1Kv2ozAJTOE) (TheRealConcertKing, 6:34, 2015-04-11; third-party; metadata only).
