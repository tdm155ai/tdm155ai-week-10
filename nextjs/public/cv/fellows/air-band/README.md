# Air Band 🎺 🎹 🎸 🥁 🎛️

> [!IMPORTANT]
> One page: what this is, where it stands, how to run it in 2 minutes, and how to use it in class.

Play invisible instruments in front of a webcam — up to 5 people at once, each in their own column of the video.
Hand and body tracking is Google's MediaPipe, running in the browser. Nothing is recorded or uploaded.

## Run it

The camera needs `localhost` (opening `index.html` directly won't work), so serve the folder:

```bash
cd air-band
python3 -m http.server 8765
```

Open http://localhost:8765 in Chrome, choose the players and instruments in the **Players** panel, and click **Start camera + sound**.
An internet connection is needed the first time, to load MediaPipe and its models from a CDN.

## The instruments

| | How to play |
|---|---|
| 🎺 Trumpet | One hand at your mouth, the other in front of it. Curl the far hand's index/middle/ring fingers for valves 1/2/3. |
| 🎹 Piano | One note per finger, middle fingers are C (left hand C3, right hand C4). Bend a finger down to play. Press **Calibrate fingers** first. |
| 🎸 Guitar | Swing your strumming index fingertip through the strings zone. The other hand picks the chord by how many fingers you hold up. |
| 🥁 Drums | Point a finger into a pad, or tap down with an open palm. Swipe an open palm to change kits. Pinch to record a loop, pinch again to close it. |
| 🎛️ Filter | Shapes the whole band's sound. Right hand: pinch thumb + index to cut the treble. Left hand: pinch to cut the bass. Raise your hands for resonance. |

The computer keyboard plays Player 1's instrument (keys are listed in each instrument's panel).

## Files

- `index.html` — the page and sidebar
- `js/band.js` — camera, tracking, player columns, controls
- `js/trumpet.js`, `js/piano.js`, `js/guitar.js`, `js/drums.js`, `js/filter.js` — one file per instrument
- `js/common.js` — shared audio engine and drawing helpers
- `air-guitar.js` — the air guitar module
- `js/hand-drums/` — hand drums gestures and sounds (`audio.js` has a small addition so it plays through the band's mixer)
- `samples/` — recorded trumpet and piano notes

## Credits

- Trumpet recordings: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus Brosowsky (CC-BY 3.0)
- Piano recordings: Salamander Grand Piano by Alexander Holm (CC-BY 3.0)
- Hand tracking: [MediaPipe](https://developers.google.com/mediapipe) (Apache-2.0)
