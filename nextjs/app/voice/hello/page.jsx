import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import VoiceTabs from "../../../lib/voice/VoiceTabs.jsx";
import Hello from "./Hello.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Voice: hello in one file" };

// The smallest version: everything in Hello.jsx beside this file.
export default function VoiceHelloPage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Voice cues · in one file</p>
            <h1>One word, one file</h1>
            <p>The whole mechanic in one short file you can read top to bottom. Open it in your editor beside this page.</p>
          </div>
        </div>
        <VoiceTabs current="/voice/hello" />
        <Hello />
      </main>
      <SiteFooter />
    </>
  );
}
