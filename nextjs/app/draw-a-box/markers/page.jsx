import Link from "next/link";
import PrintButton from "./PrintButton.jsx";
import { CORNER_IDS, CORNER_NAMES } from "../../../lib/cv/aruco.js";
import "../../../lib/cv/cv.css";

// /draw-a-box/markers: the printable ArUco markers for "Box from: printed markers" on /draw-a-box.
// One marker per letter page, as big as fits, so the overhead camera can see them from high up.
// The marker images are in public/cv/aruco/ (4×4 dictionary, ids 0–7; 4–7 are spares for your own ideas).

export const metadata = { title: "Draw a box: printed markers" };

export default function MarkersPage() {
  return (
    <div className="print-root">
      <main className="print-main markers-page">
        <div className="markers-intro">
          <p className="print-bar"><span>TDM 155AI week 10 · draw a box</span><span>ArUco 4×4 markers</span></p>
          <h1>Printed markers for draw-a-box</h1>
          <p className="lede">Print these four pages (one marker each, no scaling needed), cut them out with the white border intact, and lay them at the corners of your box as the camera sees it: 0 top left, 1 top right, 2 bottom right, 3 bottom left. On <Link href="/draw-a-box">/draw-a-box</Link>, set <strong>Box from</strong> to <em>printed markers</em>. Three are enough; if a hand covers one, the fourth corner is guessed. The box is the space between the markers&apos; inner corners.</p>
          <PrintButton />
        </div>
        {CORNER_IDS.map((id) => (
          <section key={id} className="marker-sheet">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/cv/aruco/marker-${id}.svg`} alt={`ArUco marker ${id}`} />
            <p><strong>{id}</strong> · {CORNER_NAMES[id]}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
