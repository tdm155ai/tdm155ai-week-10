# Spectrogram (Chrome Music Lab, via ll-26-27/spectrogram-next)

`/launch/spectrogram` is the **Chrome Music Lab Spectrogram** by Google Creative Lab (Copyright 2016 Google Inc., Apache License 2.0; the license header is kept in every engine file), brought in on 2026-11-11 from **[ll-26-27/spectrogram-next](https://github.com/ll-26-27/spectrogram-next)** (commit `059ffc1`), a hybrid Next.js port of it. The original: https://musiclab.chromeexperiments.com/Spectrogram/ and https://github.com/googlecreativelab/chrome-music-lab.

## What came from where

- `legacy/`: the port's `src/legacy/`, the original WebGL and Web Audio engine. Changed only: shader and `empty.mp3` paths point to `/samples/spectrogram/`, and the files end in `.cjs` (this app's `package.json` is `"type": "module"`, so CommonJS files must say so), with the `require` paths to match.
- `SpectrogramShell.jsx`: the port's `src/app/SpectrogramShell.js` (the canvas and the button bar, unchanged), plus: a credit line, o3djs loaded with a script tag (this app's root layout isn't the spectrogram's), and a full reload when you leave the page (the port notes that the legacy engine can't be stopped yet).
- `spectrogram.css`: the port's `src/app/*.scss`, compiled once with Sass 1.77.8 and nested under `.spectrogram-page` so it can't restyle the rest of the site; `rem` turned into `px` (the original sets the root font size to 62.5%). The Google Fonts import was dropped.
- `public/samples/spectrogram/`: the port's `public/bin/shaders`, `public/bin/snd` (Chrome Music Lab's sounds), `public/icons`, `public/images/finger_anim.png`, `public/legacy-libs/o3djs-bundle.js`.
- **Not in this repo:** the port's Adele and Billie Eilish tracks and photos (copyrighted). The page looks for them in the gitignored `_media/spectrogram/`, so they work on machines that have them and are silent elsewhere.
- `jquery@3.7.1` was added to the app's dependencies (the engine needs it).

## Changing it

To add a sound button, copy one of the `music-box__buttons__button` blocks in `SpectrogramShell.jsx` and point `data-src` at a file in `public/samples/` or `_media/` (`/media/...`). The mic and draw buttons, file drag-and-drop, and the 3D view are the original's.
