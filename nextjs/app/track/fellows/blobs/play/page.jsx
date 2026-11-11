// Blobs' camera page, on its own with its own styles. /track/fellows/blobs shows it in a frame.
import Link from "next/link";
import Camera from "../src/camera.jsx";
import "../src/blobs.css";

export const metadata = { title: "Blobs" };

export default function BlobsPage() {
  return (
    <div className="shell">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/track/fellows" target="_top">Fellows</Link>
        <span>/</span>
        <span>Blobs</span>
      </nav>
      <p className="eyebrow">Experiment 01</p>
      <h1 className="page-title">Blobs</h1>
      <p className="lede">
        Start the camera here, then open the display on your second screen and press Fullscreen. A ghost
        trail follows your head; fluid splashes follow each index finger. This page only shows what the
        camera sees, so the shaders run on the display alone.
      </p>
      <Camera />
    </div>
  );
}
