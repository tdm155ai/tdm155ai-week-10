---
title: The fellows' experiments
description: "What Learning Lab fellows built with Claude Code and MediaPipe this week: drums, finger pads, a gesture camera, a five-person air band, and head and finger trails. Each one's input, output, and the file to change."
order: 6
---

The Learning Lab's fellows spent a session building with Claude Code and MediaPipe, a prompt at a time, the same way you will today. Each experiment below is one **input** wired to one **output** (see [inputs and outputs](/repertoire)). All five are playable here: [/track/fellows](/track/fellows) lists them. The folder under each is where to start reading and changing the code.

## Hand drums (purple)

A webcam drum kit. Point a finger into one of four pads across the top and it plays once; slap with an open palm for the pad's second sound. Four kits: drum kit, bongos, congas, electro. A pinch records a loop into a tray at the bottom.

- **Input:** hand landmarks (MediaPipe Hand Landmarker, two hands): the fingertip entering a pad, how fast it's moving down, pointed finger vs. open palm vs. pinch.
- **Output:** drum sounds made in the browser with Web Audio (no samples), and loops.
- **Worth stealing:** the speed graph. A hit counts only when the downstroke is fast enough, and the dashed line on the graph is that threshold. It's the same idea as the debounce in [/track](/docs/track), made visible.
- **Play it here:** [/track/fellows/hand-drums](/track/fellows/hand-drums), plain HTML and JavaScript. **Start reading:** `nextjs/public/cv/fellows/hand-drums/` (`gestures.js` the gestures, `audio.js` the drum sounds, `app.js` the camera and drawing).

## Finger sounds (green)

Touch your thumb to a fingertip and that finger plays a sound: a clap, a timbale, a tambourine, a kick. Four fingers per hand, so two hands make an eight-pad sound board, plus a four-beat looper for layering beats.

- **Input:** the distance between the thumb tip and each fingertip (a pinch, per finger).
- **Output:** eight sounds and a looper.
- **Worth stealing:** the smallest possible instrument: one number (thumb-to-finger distance) under a threshold. Compare **Pinch** on [/track/instruments](/track/instruments).
- **Play it here:** [/track/fellows/finger-sounds](/track/fellows/finger-sounds), Next.js. **Start reading:** `nextjs/app/track/fellows/finger-sounds/src/` (`lib/pads.js` and `lib/sounds.js` decide which finger plays what; `FingerSounds.jsx` is the page).

## Gesture camera (green, built from Finger Sounds)

A camera you run with your hands, so a performer can run it from the stage without touching the computer. Thumbs up starts recording, thumbs down stops. Pinch and move a hand up or down to brighten or darken the picture. Pinch with both hands to grab yourself: pull apart to grow, push together to shrink, slide sideways to move. A peace sign blurs the background behind you.

- **Input:** hand gestures and pinches (Hand Landmarker), plus **person segmentation** (MediaPipe's Selfie Segmenter: which pixels are you).
- **Output:** the live video itself: recording, brightness, background blur, your size and position.
- **Worth stealing:** the live camera as the output, the way [Sunset Blvd. and Dorian Gray](/inspiration/contemporary/live-camera) put a camera on stage. And it was built by changing an earlier experiment, which is how most of this app was made too.
- **Play it here:** [/track/fellows/gesture-camera](/track/fellows/gesture-camera), Next.js. **Start reading:** `nextjs/app/track/fellows/gesture-camera/src/` (`lib/gestures.js` the gestures, `lib/look.js` the light controls, `GestureCamera.jsx` the page).

## Air Band (orange)

Up to five people in front of one webcam, each in a column, each playing an instrument with their hands:

| Instrument | How you play it |
| --- | --- |
| Trumpet | One hand at your mouth, the other in front; curl fingers for the valves |
| Piano | One note per finger, middle fingers are C; bend a finger to play |
| Guitar | Strum through an on-screen line; the other hand's finger count picks the chord |
| Drums | Point into a pad or tap with a palm (purple's hand drums) |
| Filter | Pinch thumb and index to muffle or thin out the whole band |

- **Input:** hands and bodies (Hand and Pose Landmarker), split into one column per player.
- **Output:** trumpet and piano samples, synthesized guitar and drums, and a filter over everything (compare the [XY pad](/launch/xy)).
- **Worth stealing:** one camera, many players. The picture is cut into columns, like [/track/zones](/track/zones), and each column is its own instrument. Four people played it together on November 10.
- **Play it here:** [/track/fellows/air-band](/track/fellows/air-band), plain HTML and JavaScript. **Start reading:** `nextjs/public/cv/fellows/air-band/` (one file per instrument in `js/`: `trumpet.js`, `piano.js`, `guitar.js`, `drums.js`, `filter.js`; `js/band.js` makes the columns).

## Blobs (purple)

Start the camera on one screen and open the display on a second screen, full screen. A ghost trail follows your head; fluid splashes follow each index finger.

The splash is kept light so it stays smooth: one fluid simulation follows both hands (left red, right blue) at a lower resolution, and it starts fresh every 45 seconds or when you press **Reset the splash** on the display. The head trail and the tracking keep running through a reset. Both numbers are at the top of `effects.jsx`: `SPLASH` (the resolution) and `RESET_SECONDS`.

- **Input:** head and index-fingertip positions (MediaPipe Face Detector and Hand Landmarker).
- **Output:** **shaders**: graphics the GPU draws pixel by pixel, on a separate display window. The ghost and splash effects are adapted from [React Bits](https://github.com/DavidHDev/react-bits) (David Haz), changed so a camera tracker drives them instead of the mouse.
- **Worth stealing:** the split between a control screen and a display screen, the same as this app's controller pages and [/stage](/stage). And it's a step up in graphics: compare [/track/three](/track/three).
- **Play it here:** [/track/fellows/blobs](/track/fellows/blobs), JavaScript. **Start reading:** `nextjs/app/track/fellows/blobs/src/` (`camera.jsx` face and hands, `effects.jsx` which effect follows what, `colors.js` the colors; `react-bits/` the two effects, MIT + Commons Clause, see `react-bits/LICENSE.react-bits.md`).

## Also from the session

- **MIDI studies (purple):** a channel monitor for a ROLI Seaboard BLOCK, an MPE controller that sends each held note on its own MIDI channel with its own pitch bend, slide, and pressure. More continuous controls per finger than a pad controller (compare [/launch/midi](/launch/midi)).
- **Seeing Machines:** a history of computers and AI in art installations, with recreations: a live camera cut into tiles, some blocked out in color and captioned by a vision model; an exquisite corpse; an ELIZA gallery critic; a Vera Molnar plotter grid. It isn't MediaPipe and needs a model key, so it isn't in this app. It's a good model for an installation that looks at the audience.

## Make your own

Every one of these began as a sentence typed to Claude Code. Some starting points, all in this app:

- "Make a page under `/track` where touching my thumb to each fingertip fires a different stage cue, with the pinch distance shown as a number for each finger."
- "Split the camera into three columns like Air Band; in each column, a raised hand plays a different sound from `public/samples/`."
- "On /track/three, make the wave follow my head instead of my hand."

More in [Prompts for Claude Code](/prompts).
