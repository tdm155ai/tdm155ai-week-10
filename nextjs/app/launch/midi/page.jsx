import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import MidiBoard from "../../../lib/launch/MidiBoard.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "MIDI controller", description: "Pads, keys, and dials from a MIDI controller fire cues and move the stage." };

export default function MidiPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Launch · MIDI</p>
            <h1>A MIDI controller as a lighting board</h1>
            <p>Plug in a drum pad or an Akai MPK (USB), press Connect, and watch the monitor: every pad, key, and dial sends a number. Pads fire cues; dials fade the picture and the sound.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/midi" />
        <MidiBoard />
      </main>
      <SiteFooter />
    </>
  );
}
