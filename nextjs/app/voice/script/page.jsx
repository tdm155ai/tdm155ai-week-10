import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import ScriptFollower from "../../../lib/voice/ScriptFollower.jsx";
import VoiceTabs from "../../../lib/voice/VoiceTabs.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Follow a script", description: "Read a sonnet aloud; the page follows along and fires cues at marked words." };

export default function ScriptPage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Voice cues · Follow a script</p>
            <h1>Read it, and the cues come</h1>
            <p>The page knows the text you're reading. It listens, keeps your place even when it mishears a word, and fires each cue when you reach the word it's marked on. Surtitles, show control, and a reading in one.</p>
          </div>
        </div>
        <VoiceTabs current="/voice/script" />
        <ScriptFollower />
      </main>
      <SiteFooter />
    </>
  );
}
