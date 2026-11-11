import { getRoot, site } from "../lib/content.mjs";
import { SiteFooter, SiteHeader } from "./components/Chrome.jsx";
import Markdown from "./components/Markdown.jsx";
import Link from "next/link";

export const dynamic = "force-dynamic";

// The home page is the intro (content/README.md).

export default async function Home() {
  const root = await getRoot();

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="article-shell" aria-labelledby="site-title">
          <p className="eyebrow">{site.label} · {site.term}</p>
          <div className="article-heading">
            <h1 id="site-title">Installations and Live Events</h1>
            <p className="lede">November 11, 2026 · Make something happen in the room.</p>
          </div>
          <nav className="folder-tools" aria-label="Start and explore">
            <Link className="folder-tool" href="/launch"><strong className="folder-tool-title">Start with a cue</strong><span className="folder-tool-copy">Buttons and keys → MIDI → voice → a raised hand</span></Link>
            <Link className="folder-tool" href="/inspiration"><strong className="folder-tool-title">See the shows</strong><span className="folder-tool-copy">Clips, professional tools, and maneuvers to build</span></Link>
          </nav>
          {root.content.trim() && <article className="prose"><Markdown doc={root} /></article>}
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
