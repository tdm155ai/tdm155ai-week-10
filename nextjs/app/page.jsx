import { site } from "../lib/content.mjs";
import { SiteFooter, SiteHeader } from "./components/Chrome.jsx";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "Live Events" };

export default function Home() {
  return (
    <>
      <SiteHeader current="home" />
      <main id="main">
        <section className="article-shell home-shell" aria-labelledby="site-title">
          <p className="eyebrow">{site.label} · {site.term}</p>
          <div className="article-heading home-heading">
            <h1 id="site-title">Live Events</h1>
            <p className="home-topics">&amp; installations, projections, cue systems, sound, light, tracking, shaders &amp; interactive performance.</p>
          </div>
          <nav className="folder-tools landing-doors" aria-label="Explore the week">
            <Link className="folder-tool" href="/inspiration"><strong className="folder-tool-title"><span>Shows</span><span aria-hidden="true">↗</span></strong><span className="folder-tool-copy">Concerts, performances &amp; installations</span></Link>
            <Link className="folder-tool" href="/inputs-outputs"><strong className="folder-tool-title"><span>Inputs &amp; outputs</span><span aria-hidden="true">↗</span></strong><span className="folder-tool-copy">What you can sense. What you can make happen.</span></Link>
            <Link className="folder-tool" href="/experiments"><strong className="folder-tool-title"><span>Experiments</span><span aria-hidden="true">↗</span></strong><span className="folder-tool-copy">Open, try &amp; change an example</span></Link>
          </nav>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
