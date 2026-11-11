import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import CueList from "../../../lib/launch/CueList.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Cue list", description: "A Go-button cue list, like QLab: Go, back, panic." };

export default function CueListPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Launch · Cue list</p>
            <h1>Standing by… Go</h1>
            <p>How theater runs a show (QLab is the usual app): every moment is a numbered cue in order, and the operator presses Go on the stage manager's call. One button, the whole show.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/cue-list" />
        <CueList />
      </main>
      <SiteFooter />
    </>
  );
}
