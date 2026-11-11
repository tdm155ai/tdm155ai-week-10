import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import ShaderView from "../../../lib/launch/ShaderView.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Particles", description: "Particles circling an attractor, with trails that swirl like smoke: the shader reads its own last frame. Move the pointer (or your palm) to move the vortex; click (or pinch) to fling the particles out." };

export default function Page() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Outputs · graphics · shader</p>
            <h1>A particle vortex</h1>
            <p>Particles circling an attractor, with trails that swirl like smoke: the shader reads its own last frame. Move the pointer (or your palm) to move the vortex; click (or pinch) to fling the particles out.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/particles" />
        <ShaderView which="particles" />
      </main>
      <SiteFooter />
    </>
  );
}
