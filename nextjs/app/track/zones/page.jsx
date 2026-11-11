import { SiteHeader } from "../../components/Chrome.jsx";
import BodyZones from "./BodyZones.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Track: body zones" };

export default function TrackZonesPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <BodyZones />
      </main>
    </>
  );
}
