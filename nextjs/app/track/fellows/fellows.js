// The fellows' experiments: play them, then read their code. `files` is where to start reading.

export const fellows = [
  {
    slug: "hand-drums", title: "Hand drums",
    what: "A webcam drum kit: point a finger and tap down, or tap with an open palm. Swipe an open palm sideways to change drums; pinch to start and stop a loop; grab a loop from the tray with a fist.",
    src: "/cv/fellows/hand-drums/index.html",
    files: "public/cv/fellows/hand-drums/ (gestures.js: the gestures; audio.js: the drum sounds; app.js: the camera and drawing)",
  },
  {
    slug: "finger-sounds", title: "Finger sounds",
    what: "Touch your thumb to a fingertip to play one of eight sounds, with a looper to layer beats.",
    src: "/track/fellows/finger-sounds/play",
    files: "app/track/fellows/finger-sounds/src/ (lib/pads.js and lib/sounds.js: which finger plays what; FingerSounds.jsx: the page)",
  },
  {
    slug: "gesture-camera", title: "Gesture camera",
    what: "A camera run by your hands: thumbs up records, thumbs down stops; pinch and move to change the light; pinch with both hands to resize and move yourself; a peace sign blurs the background.",
    src: "/track/fellows/gesture-camera/play",
    files: "app/track/fellows/gesture-camera/src/ (lib/gestures.js: the gestures; lib/look.js: the light controls; GestureCamera.jsx: the page)",
  },
  {
    slug: "air-band", title: "Air Band",
    what: "Up to five people play trumpet, piano, guitar, drums, and a whole-band filter with their hands in front of one webcam, each in their own column.",
    src: "/cv/fellows/air-band/index.html",
    files: "public/cv/fellows/air-band/ (js/trumpet.js, js/piano.js, js/guitar.js, js/drums.js, js/filter.js: one file per instrument; js/band.js: the columns)",
  },
  {
    slug: "blobs", title: "Blobs",
    what: "A ghost trail follows your head and fluid splashes follow each index finger, on a second screen. Start the camera, then open the display window, drag it to the projector, and press Fullscreen.",
    src: "/track/fellows/blobs/play",
    files: "app/track/fellows/blobs/src/ (camera.jsx: face and hands; effects.jsx: which effect follows what; colors.js: the colors; react-bits/: the two effects, MIT + Commons Clause, see LICENSE.react-bits.md)",
  },
];
