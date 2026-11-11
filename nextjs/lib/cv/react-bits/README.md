# React Bits effects

`SplashCursor.jsx` (a WebGL fluid simulation) and `GhostCursor.jsx` (a Three.js glowing trail) are from [React Bits](https://reactbits.dev) by David Haz, under the MIT + Commons Clause license in `LICENSE.react-bits.md`. They came into this app with the fellows' Blobs experiment (`app/track/fellows/blobs/src/react-bits/`), converted from TypeScript to JavaScript with the comments kept.

Changes for the class app, each marked "Class app" in the code: a tracker can carry its own color (SplashCursor), and SplashCursor gives its WebGL context back when its canvas leaves the page, so the demos' periodic resets don't pile up GPU contexts.

Used by `/track/effects/splash` and `/track/effects/ghost`.
