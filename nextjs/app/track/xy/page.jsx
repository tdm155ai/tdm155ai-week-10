import Link from "next/link";
import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import XYPad from "../../../lib/launch/XYPad.jsx";
import "../../../lib/stage/controls.css";

// /track/xy: TR's XY pad (lib/launch/XYPad.jsx, the same one as /launch/xy) in camera mode, under tracking.

export const metadata = { title: "Track: XY pad", description: "Your hand sweeps a Kaoss-pad-style filter and echo over an EDM loop." };

export default function TrackXYPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Track · XY pad</p>
            <h1>Your hand is the filter</h1>
            <p>Press Play and hold a hand up to the camera: the mirrored picture is the pad. Left muffles the loop (low-pass), right thins it out (high-pass), up makes the filter ring. Take your hand away and it springs back. The same pad with a mouse is <Link href="/launch/xy">/launch/xy</Link>; more hand tracking at <Link href="/track">/track</Link> and <Link href="/track/instruments">/track/instruments</Link>.</p>
          </div>
        </div>
        <XYPad control="camera" />
      </main>
      <SiteFooter />
    </>
  );
}
