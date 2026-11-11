import { SiteFooter, SiteHeader } from "../components/Chrome.jsx";
import LaunchPad from "../../lib/launch/LaunchPad.jsx";
import LaunchTabs from "../../lib/launch/LaunchTabs.jsx";
import "../../lib/stage/stage.css";
import "../../lib/stage/controls.css";

export const metadata = { title: "Launch", description: "Buttons and keys that fire cues on the stage." };

export default function LaunchPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Launch · Hello World</p>
            <h1>Buttons and keys</h1>
            <p>Every button is a cue. Open the stage window (put it on the projector), then click a button or press its key. Space is Go.</p>
          </div>
        </div>
        <LaunchTabs current="/launch" />
        <LaunchPad />
      </main>
      <SiteFooter />
    </>
  );
}
