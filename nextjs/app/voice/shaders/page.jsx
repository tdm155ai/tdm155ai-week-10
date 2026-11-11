import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import VoiceTabs from "../../../lib/voice/VoiceTabs.jsx";
import VoiceSplash from "../../../lib/voice/VoiceSplash.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Say splash", description: "Say a word and a fluid simulation splashes: trigger words driving a shader." };

export default function VoiceShadersPage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Voice cues · words + shaders</p>
            <h1>Say “splash”</h1>
            <p>Press Listen and say <strong>splash</strong>: the fluid bursts from the middle of the screen. Other words do other splashes. Literal words, no AI, no key. Press F for full screen, Space or the button to splash by hand.</p>
          </div>
        </div>
        <VoiceTabs current="/voice/shaders" />
        <VoiceSplash />
      </main>
      <SiteFooter />
    </>
  );
}
