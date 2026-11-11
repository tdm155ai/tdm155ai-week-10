import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import CompareEngines from "../../../lib/voice/CompareEngines.jsx";
import VoiceTabs from "../../../lib/voice/VoiceTabs.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Compare engines", description: "Chrome's Web Speech and OpenAI's realtime transcription, side by side, racing to the trigger words." };

export default function ComparePage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Voice cues · Two listeners</p>
            <h1>Compare engines</h1>
            <p>Two transcription engines listen to the same voice: Chrome's built-in Web Speech (free) and OpenAI's <code>gpt-live-transcribe</code> (uses the OpenAI key in the repo's <code>.env</code>, which stays on the server). Both watch for the trigger words; the table shows who heard each one first. Running two listeners and firing on the first is one way to get latency down.</p>
          </div>
        </div>
        <VoiceTabs current="/voice/compare" />
        <CompareEngines />
      </main>
      <SiteFooter />
    </>
  );
}
