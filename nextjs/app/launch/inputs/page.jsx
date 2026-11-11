import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import InputDiagnostics from "../../../lib/launch/InputDiagnostics.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Inputs: is it working?", description: "A quick check for each input: keys, MIDI, microphone, a sound file, the pointer." };

export default function InputsPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Inputs · diagnostics</p>
            <h1>Is it working?</h1>
            <p>The raw numbers each input gives the browser, before anything becomes a cue.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/inputs" />
        <InputDiagnostics />
      </main>
      <SiteFooter />
    </>
  );
}
