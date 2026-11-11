import { SiteHeader } from "../../components/Chrome.jsx";
import FacePaint from "./FacePaint.jsx";
import "../../../lib/cv/cv.css";
import "./face-paint.css";

// From mk-realtime-prototypes /face-paint (Marlon, Sep 25–29, 2026). The experiment is ./FacePaint.jsx; the face mesh
// is ../../../lib/cv/face-mesh-data.js (generated from Google's canonical face model, Apache 2.0; don't edit by hand).

export const metadata = { title: "Track: face paint", description: "Paint on a flat face; the paint lands on your face." };

export default function FacePaintPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <div className="cv-page fp-root">
          <div className="cv-head">
            <p className="eyebrow">Track · Face paint</p>
            <h1>Paint on your face.</h1>
            <p className="cv-lede">Paint on the flat face on the right; the paint lands on your face on the left. Everything runs in this tab: the camera never leaves your computer. MediaPipe finds 468 points on your face; Three.js stretches the paint over them. The whole experiment is <code>app/track/face-paint/FacePaint.jsx</code>. By Marlon Kuzmick.</p>
          </div>
          <FacePaint />
        </div>
      </main>
    </>
  );
}
