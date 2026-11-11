import { SiteFooter, SiteHeader } from "../../components/Chrome.jsx";
import LaunchTabs from "../../../lib/launch/LaunchTabs.jsx";
import Hello from "./Hello.jsx";
import "../../../lib/stage/controls.css";

export const metadata = { title: "Launch: hello in one file" };

// The smallest version: everything in Hello.jsx beside this file.
export default function LaunchHelloPage() {
  return (
    <>
      <SiteHeader current="launch" />
      <main id="main" className="ctl-shell">
        <div className="ctl-head">
          <div>
            <p className="eyebrow">Launch · in one file</p>
            <h1>One key, one file</h1>
            <p>The whole mechanic in one short file you can read top to bottom. Open it in your editor beside this page.</p>
          </div>
        </div>
        <LaunchTabs current="/launch/hello" />
        <Hello />
      </main>
      <SiteFooter />
    </>
  );
}
