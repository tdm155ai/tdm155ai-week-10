import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import HandLaunch from "./HandLaunch.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Hand launch", description: "Launch clips, synths, and MIDI with a hand gesture." };

export default function Page() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <LaunchTabs current="/launch/hand" />
        <HandLaunch />
      </main>
      <SiteFooter />
    </>
  );
}
