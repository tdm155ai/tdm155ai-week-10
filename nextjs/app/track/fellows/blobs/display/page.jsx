// Blobs' display: open it from the camera page ("Open display window"), drag it to the projector, press Fullscreen.
import Display from "../src/display.jsx";
import "../src/blobs.css";

export const metadata = { title: "Blobs display" };

export default function BlobsDisplayPage() {
  return <Display />;
}
