import { SiteHeader } from "../../components/Chrome.jsx";
import Three from "./Three.jsx";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Track: Three.js", description: "A 3D wave field you play with sliders, the mouse, or your hand." };

export default function TrackThreePage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <Three />
      </main>
    </>
  );
}
