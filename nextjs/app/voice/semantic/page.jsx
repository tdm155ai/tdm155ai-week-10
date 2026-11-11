import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import SemanticCues from "../../../lib/voice/SemanticCues.jsx";
import VoiceTabs from "../../../lib/voice/VoiceTabs.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Cues by topic", description: "Talk freely; a small AI model decides what you're talking about and brings up the matching cue." };

export default function SemanticPage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Voice cues · By topic (with AI)</p>
            <h1>Cues by topic</h1>
            <p>No script, no magic words. At each pause, a small AI model reads what you just said and decides which topic you're on; when it's sure, that topic's picture or sound comes up. When it thinks a topic is coming, it "arms" it, and the first matching word fires it instantly. A lecturer's slides that follow the lecture.</p>
          </div>
        </div>
        <VoiceTabs current="/voice/semantic" />
        <SemanticCues />
      </main>
      <SiteFooter />
    </>
  );
}
