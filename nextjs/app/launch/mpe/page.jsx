import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import MpePlayer from "../../../lib/launch/MpePlayer.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Seaboard (MPE)", description: "Play a ROLI Seaboard BLOCK or any MIDI keyboard and see every touch: bend, slide, pressure, wiggle." };

export default function MpePage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Launch · Seaboard (MPE)</p>
            <h1>See every touch</h1>
            <p>Plug in the ROLI Seaboard BLOCK (USB or Bluetooth), click <strong>Connect MIDI</strong>, and play. Each finger gets its own sound and its own glowing dot: sideways is pitch (slide your finger to bend, wiggle it for vibrato), up and down the key is <em>slide</em> (the sound brightens), pressing harder makes it louder and bigger. The trails show the glides and wiggles. No Block? Drag on the picture. Ordinary MIDI keyboards work too. F for full screen, Esc to silence everything.</p>
            <p className="ctl-note">From the purple fellow's MIDI studies (LL week 10 experiments). Sounds and colors: <code>nextjs/lib/launch/mpe.js</code>.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/mpe" />
        <MpePlayer />
      </main>
      <SiteFooter />
    </>
  );
}
