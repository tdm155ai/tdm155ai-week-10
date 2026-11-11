import { SiteFooter, SiteHeader } from "../components/Chrome.jsx";
import LaunchPad from "../../lib/launch/LaunchPad.jsx";
import LaunchTabs from "../../lib/launch/LaunchTabs.jsx";
import ZoneLinks from "../components/ZoneLinks.jsx";
import "../../lib/stage/stage.css";
import "../../lib/stage/controls.css";

export const metadata = { title: "Launch", description: "Buttons and keys that fire cues on the stage." };

export default function LaunchPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <ZoneLinks group="launch" />
        <div className="ctl-head" style={{ marginTop: 32 }}>
          <div>
            <p className="eyebrow">Try it here · Hello World</p>
            <h1>Buttons and keys</h1>
            <p>Open the stage window, then click a button or press its key. Space is Go.</p>
          </div>
        </div>
        <LaunchTabs current="/launch" />
        <LaunchPad />
      </main>
      <SiteFooter />
    </>
  );
}
