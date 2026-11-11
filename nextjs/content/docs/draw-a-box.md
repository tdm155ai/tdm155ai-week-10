---
title: Draw a box
order: 5
description: Draw a rectangle on paper under the overhead camera (or lay down a colored card or printed markers), say a word, and a clip plays inside it.
---

**Open:** [/draw-a-box/hello](/draw-a-box/hello) (Hello World), then [/draw-a-box](/draw-a-box). Use Chrome; allow the camera, and the microphone if you use voice.

## What it does

The idea: people often present by drawing under an overhead camera, a big piece of paper filling the frame. What if you could draw a box and have a video show up inside it, with a spoken word choosing which video?

1. **Find the box.** [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html), the browser build of the classic computer-vision library, looks at each frame: grayscale, an adaptive threshold (dark ink on light paper becomes white lines on black), then `findContours` and `approxPolyDP` keep shapes with exactly four corners. The biggest one wins. No training, no model.
2. **Steady it.** Small wobbles are smoothed, a one-frame jump is ignored, and if your hand covers the box it holds for a second. **Lock the box** (or press `L`) freezes it while you keep drawing.
3. **Warp the clip onto it.** A homography (the math of projecting a rectangle onto any four corners) becomes a CSS `matrix3d` transform on the clip (a GIF or a video).
4. **Pick the clip by voice.** Press **Listen**; Chrome's speech recognition (`lib/voice/speech.js`) watches for the words in `clips.js`. Or click a clip, or press its number; `0` or "clear" empties the box.

OpenCV.js is about 11 MB. It loads only on this page, from jsDelivr (or opencv.org as a backup); after the first time the browser caches it.

## Hello World: a box appears, a cue fires

[/draw-a-box/hello](/draw-a-box/hello) is the box-finding in one short file, `app/draw-a-box/hello/Hello.jsx`: camera, OpenCV, threshold, contours, the biggest four-cornered shape outlined. When a box appears, one cue fires on the stage; it re-arms after half a second without a box. Change `SMALLEST`, `CUE`, and `COLOR` at the top.

## Try it

1. Tape a big sheet of paper under the overhead camera (or hold your laptop camera over a page). Open [/draw-a-box](/draw-a-box) and pick the camera. Leave **Mirror** off for an overhead camera.
2. Draw a rectangle in **thick, dark marker**. Close the corners. A green outline appears when OpenCV finds it.
3. Click **Listen** and say "title" or "bars" or "fractal". The clip plays inside the box.
4. **Full screen** (or `F`) for the projector or a stream. **Hide the camera** shows only the clip on black.

## More than one box, cards, and printed markers

- **Several boxes:** **Boxes** (1–6, default 4) finds that many at once, each followed and steadied on its own, each with its own clip: left to right, the chosen clip, then the next ones.
- **Pick by: card color.** Lay a colored index card on the paper: the card is the box, and its color picks the GIF (red fractal, yellow bars, green life, blue gradient; a yellow card on white paper counts). Grey, white, and black cards pick nothing.
- **Box from: printed markers (0–3).** When drawn lines are unreliable under the studio lights. Print [/draw-a-box/markers](/draw-a-box/markers) (four letter pages, one marker each, about 7 inches; there's a Print button), cut them out **keeping the white border**, and lay 0 top left, 1 top right, 2 bottom right, 3 bottom left as the camera sees them. The box is the space between the markers' inner corners. Three are enough: cover one with a hand and the fourth corner is guessed ("markers seen" says so). **What OpenCV sees** shows the gray image the marker detector reads. Spare markers 4–7 are in `public/cv/aruco/` for your own ideas (`findMarkers` in `lib/cv/aruco.js` returns every marker's id and corners).

## The one file to change: `app/draw-a-box/clips.js`

```js
export const clips = [
  { word: "bars", label: "Color bars", src: "/cv/gifs/bars.gif" },
  { word: "title", label: "Title card", src: "/cv/gifs/title.gif" },
  // add yours: put rain.gif (or rain.mp4) in the repo's _media/ folder, then
  // { word: "rain", label: "Rain", src: "/media/rain.gif" },
];
```

Below the clips, `cards` sets which card color picks which GIF (`hue` is the color's place on the color wheel: 0 red, 55 yellow, 120 green, 210 blue).

Pick words that are clear when spoken and that you won't say by accident while you're talking about your drawing.

## When the box isn't found

The **What OpenCV sees** checkbox shows the black-and-white image it searches. You want the box as a clean, closed white outline.

- **Lines broken or faint**: use a thicker, darker marker; close the corners; raise **Ink sensitivity** a little (lower numbers pick up fainter lines and more noise; higher numbers want darker ink).
- **Picks up the wrong shape** (the paper's edge, a shadow, a sticky note): raise **Smallest box**, or keep other rectangles out of the frame. The paper's own edge is ignored if it fills more than 90% of the frame.
- **Glare from studio lights**: tilt the paper or the light; matte paper beats glossy.
- **It flickers**: press `L` to lock it once it's right.

If drawn boxes stay unreliable under the studio lights, switch **Box from** to **printed markers** (ArUco: square black-and-white codes, one at each corner, detected exactly), or use a colored card. Both are above.

## How it works (if you want to go further)

| file | what's in it |
| --- | --- |
| `app/draw-a-box/clips.js` | the words and clips (change this) |
| `app/draw-a-box/DrawABox.jsx` | the page: camera, loop, warping, voice, keys |
| `lib/cv/boxes.js` | several boxes at once, each followed frame to frame |
| `lib/cv/aruco.js` | printed markers: `findMarkers` |
| `lib/cv/opencv.js` | loads OpenCV.js; `findBox` (threshold → contours → four corners), the stabilizer, `quadTransform` (homography → CSS `matrix3d`) |
| `lib/voice/speech.js` | the speech listener (shared with `/voice`) |

## Prompts for Claude Code

- "In `app/draw-a-box/clips.js`, add three clips from my `_media/` folder with the words 'ocean', 'city', and 'night'."
- "With several boxes, let the words pick 'left box' or 'right box' for the next clip."
- "Make printed marker 4 a second box that plays its own clip."
- "When a clip starts in the box, also fire a stage cue (`fireCue` from `lib/stage/stage.js`) so the projector shows it full screen too."
- "Put an image instead of a video in the box when the word is 'photo', and let me drop an image onto the page to use."
- "Detect a drawn circle too (with `HoughCircles`) and put a spinning globe video in it."
