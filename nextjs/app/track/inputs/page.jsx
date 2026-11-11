import { SiteHeader } from "../../components/Chrome.jsx";
import Inputs from "./Inputs.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Track: inputs", description: "What the camera models see: hand, head, or body, as numbers." };

export default function TrackInputsPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <Inputs />
      </main>
    </>
  );
}
