import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import VoiceTabs from "../../../lib/voice/VoiceTabs.jsx";
import TriggerWords from "../../../lib/voice/TriggerWords.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Trigger words", description: "Your own words, each firing a stage cue: edit the list, test it, say it." };

export default function WordsPage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Voice cues · trigger words</p>
            <h1>Your words, your cues</h1>
            <p>Make a list: a word or phrase, and the stage cue it fires. Test each one by hand, then say them. Literal words only, no AI: it fires the moment Chrome writes the word down.</p>
          </div>
        </div>
        <VoiceTabs current="/voice/words" />
        <TriggerWords />
      </main>
      <SiteFooter />
    </>
  );
}
