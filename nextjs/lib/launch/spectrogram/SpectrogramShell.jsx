"use client";

// /launch/spectrogram: the Chrome Music Lab spectrogram (Copyright 2016 Google Inc., Apache License 2.0), from the
// Next.js port ll-26-27/spectrogram-next (src/app/SpectrogramShell.js), adapted to live inside this app:
//   - o3djs (public/samples/spectrogram/legacy-libs/o3djs-bundle.js) is loaded here with a script tag, because this
//     app's root layout isn't the spectrogram's;
//   - sounds, shaders, icons are under /samples/spectrogram/; the two pop songs the port added are not in this public
//     repo: they're read from the gitignored _media/spectrogram/ on machines that have them;
//   - the legacy engine can't be stopped once started (the port's own note), so leaving this page reloads the next one.
// The engine itself is ./legacy/ (the port's src/legacy/, original Chrome Music Lab code), unchanged apart from paths and the
// .cjs extension (this app is "type": "module", so CommonJS files must say so).

import { useEffect } from "react";
import "./spectrogram.css";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.o3djs) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { existing.addEventListener("load", resolve); existing.addEventListener("error", reject); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

let leaveTimer = null;

export default function SpectrogramShell() {
  useEffect(() => {
    clearTimeout(leaveTimer); // React's development double mount: this is the same visit, not a new one

    // One-shot guard from the port: the legacy bootstrap builds an AudioContext and global listeners every time.
    if (!window.__spectrogramBooted) {
      window.__spectrogramBooted = true;
      (async () => {
        const jq = (await import("jquery")).default; // the legacy modules expect window.$ / window.jQuery
        window.$ = window.jQuery = jq;
        await loadScript("/samples/spectrogram/legacy-libs/o3djs-bundle.js");
        if (!window.o3djs) { console.error("o3djs failed to load"); return; }
        await import("./legacy/main.cjs"); // main.js wraps its body in $(fn), so it runs as soon as it loads
      })();
    }

    // Leaving: reload whatever page comes next, so the spectrogram's sound and listeners stop.
    return () => { leaveTimer = setTimeout(() => window.location.reload(), 0); };
  }, []);

  return (
    <div className="spectrogram-page">
      <div className="spectrogram-credit">
        <a href="/launch">← Launch</a>
        <span>Spectrogram from <a href="https://musiclab.chromeexperiments.com/Spectrogram/" target="_blank" rel="noreferrer">Chrome Music Lab</a> (Google Creative Lab, Apache 2.0).</span>
      </div>
      <canvas id="spectrogram" />
      <canvas id="legend" />
      <div id="iosButton" />

      <div id="record" className="music-box__modal">
        <div className="music-box__modal__message">
          <div className="music-box__modal__record-rings" />
          <div className="music-box__modal__record-rings" />
          <div className="music-box__modal__icon icon-mic" />
        </div>
      </div>

      <div id="drawAnywhere" className="music-box__modal">
        <div className="music-box__modal__message">
          <div className="music-box__hand-animation-sprite" />
        </div>
      </div>

      <div id="loadingSound" className="music-box__modal">
        <div className="music-box__modal__message">
          <div id="loadingMessage" className="music-box__modal__message__text">Flute</div>
          <svg
            className="spinner"
            width="55px"
            height="55px"
            viewBox="0 0 66 66"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="circle"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              cx="33"
              cy="33"
              r="30"
            />
          </svg>
        </div>
      </div>

      <div className="music-box__buttons">
        <div className="music-box__buttons__button" data-mic="" data-name="mic">
          <div className="icon icon-mic" />
        </div>
        <div className="music-box__buttons__button" data-draw="" data-name="draw">
          <div className="icon icon-draw" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Flute"
          data-src="/samples/spectrogram/snd/160210_flute_new_cmajor_scale.mp3"
        >
          <div className="icon icon-flute" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Harp"
          data-src="/samples/spectrogram/snd/160211_spectrogram_harp_new.mp3"
        >
          <div className="icon icon-harp" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Whistling"
          data-src="/samples/spectrogram/snd/160113_whistling.mp3"
        >
          <div className="icon icon-guy" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Trombone"
          data-src="/samples/spectrogram/snd/160113_trombone.mp3"
        >
          <div className="icon icon-trombone" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Drum_Machine"
          data-src="/samples/spectrogram/snd/160113_808_loop.mp3"
        >
          <div className="icon icon-808" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Birds"
          data-src="/samples/spectrogram/snd/160113_birds.mp3"
        >
          <div className="icon icon-bird" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Modem"
          data-src="/samples/spectrogram/snd/160113_modem.mp3"
        >
          <div className="icon icon-computer" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Spectrogram_UI_Instrament_Wine_Glass"
          data-src="/samples/spectrogram/snd/160113_wine_glass.mp3"
        >
          <div className="icon icon-wine" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Adele — Someone Like You"
          data-src="/media/spectrogram/adele_someone_like_you.mp3"
        >
          <div className="icon icon-photo icon-adele" />
        </div>
        <div
          className="music-box__buttons__button"
          data-name="Billie Eilish — What Was I Made For"
          data-src="/media/spectrogram/billie_what_was_i_made_for.mp3"
        >
          <div className="icon icon-photo icon-billie" />
        </div>
      </div>

      <div id="fileDrop">
        <div className="file-overlay">
          <div className="file-overlay-description" />
        </div>
      </div>
    </div>
  );
}
