import { SiteHeader } from "../../components/Chrome.jsx";
import Hello from "./Hello.jsx";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Track: hello in one file" };

export default function TrackHelloPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <Hello />
      </main>
    </>
  );
}
