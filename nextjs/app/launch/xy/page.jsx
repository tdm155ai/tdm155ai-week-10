import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import XYPad from "../../../lib/launch/XYPad.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "XY pad", description: "A Kaoss-pad-style filter and echo over an EDM loop made in the browser." };

export default function XYPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Launch · XY pad</p>
            <h1>Sweep the filter</h1>
            <p>Press Play, then drag on the pad: left muffles the loop (a low-pass filter), right thins it out (a high-pass), up makes the filter ring. Let go and it springs back. Switch parts on and off; try a build and a drop.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/xy" />
        <XYPad />
      </main>
      <SiteFooter />
    </>
  );
}
