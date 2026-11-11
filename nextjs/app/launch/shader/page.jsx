import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import ShaderView from "../../../lib/launch/ShaderView.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Shader", description: "A fragment shader: inputs become numbers, numbers become pixels." };

export default function ShaderPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Outputs · graphics</p>
            <h1>A shader</h1>
            <p>A tiny program the graphics card runs for every pixel, every frame, answering one question: what color is this pixel? Sliders, the pointer, the mic, a MIDI knob, or the XY pad change its numbers; the numbers change the picture.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/shader" />
        <ShaderView />
      </main>
      <SiteFooter />
    </>
  );
}
