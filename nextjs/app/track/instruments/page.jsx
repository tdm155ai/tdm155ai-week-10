import { SiteHeader } from "../../components/Chrome.jsx";
import Instruments from "./Instruments.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Track: instruments" };

export default function InstrumentsPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <Instruments />
      </main>
    </>
  );
}
