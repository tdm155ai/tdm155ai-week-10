import { SiteHeader } from "../components/Chrome.jsx";
import HelloTrack from "./HelloTrack.jsx";
import "../../lib/cv/cv.css";

export const metadata = { title: "Track: Hello World" };

export default function TrackPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <HelloTrack />
      </main>
    </>
  );
}
