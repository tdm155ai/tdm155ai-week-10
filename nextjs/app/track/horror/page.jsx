import { SiteHeader } from "../../components/Chrome.jsx";
import Horror from "./Horror.jsx";
import "../../../lib/cv/cv.css";
import "./horror.css";

// A live horror scene: filtered voice out of the speakers, a mask on the face, a hand-led ghost behind, a monologue
// with cues, and recording with playback. The file to change is ./settings.js (masks: ./masks.js, monologue:
// ./script.js). The ghost is React Bits' GhostCursor (lib/cv/react-bits/, MIT + Commons Clause); the face mesh is
// Google's canonical face model (lib/cv/face-mesh-data.js, Apache 2.0).

export const metadata = { title: "Track: horror", description: "A live horror scene: a filtered voice, a mask on your face, a ghost led by a hand, and a video to watch back." };

export default function HorrorPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <Horror />
      </main>
    </>
  );
}
