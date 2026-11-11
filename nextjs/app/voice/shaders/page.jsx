import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import VoiceTabs from "../../../lib/voice/VoiceTabs.jsx";
import VoiceSplash from "../../../lib/voice/VoiceSplash.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Hit it, splash, stop", description: "Three spoken commands: “hit it” starts the dance loop, “splash” bursts fluid over the camera, “stop” stops the music, shows STOP, then goes black." };

export default function VoiceShadersPage() {
  return (
    <>
      <SiteHeader current="voice" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Voice cues · words + shaders</p>
            <h1>Hit it, splash, stop</h1>
            <p>Press Start (it asks for the mic and camera), then say <strong>hit it</strong>: the dance loop plays and “Dance!!” flashes on your forehead. Say <strong>splash</strong>: fluid bursts over the picture. Say <strong>stop</strong>: the music stops at once, STOP shows on your forehead, then the screen goes black until the next word. Literal words, no AI, no key. F for full screen; the buttons do the same three things.</p>
          </div>
        </div>
        <VoiceTabs current="/voice/shaders" />
        <VoiceSplash />
      </main>
      <SiteFooter />
    </>
  );
}
