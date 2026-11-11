// One fellow's experiment in a frame (its own page, its own styles), with a link to open it on its own.
import Link from "next/link";
import { SiteHeader } from "../../components/Chrome.jsx";
import "../../../lib/cv/cv.css";

export default function Frame({ fellow }) {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <div className="cv-page fellow-page">
          <div className="cv-head">
            <p className="eyebrow"><Link href="/track/fellows">Fellows&apos; experiments</Link></p>
            <h1>{fellow.title}</h1>
            <p className="cv-lede">{fellow.what} <a href={fellow.src} target="_blank" rel="noreferrer">Open it on its own</a> (best for full screen). The code: <code>{fellow.files}</code>.</p>
          </div>
          <iframe className="fellow-frame" src={fellow.src} title={fellow.title} allow="camera; microphone; autoplay; fullscreen; midi" />
        </div>
      </main>
    </>
  );
}
