import { SiteFooter, SiteHeader } from "../components/Chrome.jsx";
import VoiceTabs from "../../lib/voice/VoiceTabs.jsx";
import VoiceWords from "../../lib/voice/VoiceWords.jsx";
import ZoneLinks from "../components/ZoneLinks.jsx";
import "../../lib/stage/stage.css";
import "../../lib/stage/controls.css";

export const metadata = { title: "Voice cues", description: "Say a word, a cue fires on the stage." };

export default function VoicePage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <ZoneLinks group="voice" />
        <div className="ctl-head" style={{ marginTop: 32 }}>
          <div>
            <p className="eyebrow">Try it here · trigger words</p>
            <h1>Say a word</h1>
            <p>Say a trigger word; its cue fires on the stage, often before you finish the sentence.</p>
          </div>
        </div>
        <VoiceTabs current="/voice" />
        <VoiceWords />
      </main>
      <SiteFooter />
    </>
  );
}
