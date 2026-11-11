import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import ShaderView from "../../../lib/launch/ShaderView.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Kaleidoscope", description: "Every direction folded into one mirrored slice, with a fractal inside it. Drag the Symmetry slider, or turn on your hand: across sets the slices, up the scale, a pinch freezes time." };

export default function Page() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Outputs · graphics · shader</p>
            <h1>A kaleidoscope</h1>
            <p>Every direction folded into one mirrored slice, with a fractal inside it. Drag the Symmetry slider, or turn on your hand: across sets the slices, up the scale, a pinch freezes time.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/kaleidoscope" />
        <ShaderView which="kaleidoscope" />
      </main>
      <SiteFooter />
    </>
  );
}
