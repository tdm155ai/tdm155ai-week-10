import Link from "next/link";
import { site } from "../../lib/content.mjs";

// `current` marks the section you're on; the stage opens as a separate output window.
// The routes are owned by the week 10 panes: /launch and /voice (TR), /track and /draw-a-box (CV), /pro-apps (RS, Markdown in content/pro-apps/).
const sections = [
  ["docs", "/docs", "Docs"],
  ["launch", "/launch", "Launch"],
  ["voice", "/voice", "Voice cues"],
  ["track", "/track", "Track"],
  ["draw", "/draw-a-box", "Draw a box"],
  ["pro-apps", "/pro-apps", "Pro apps"],
  ["inspiration", "/inspiration", "Inspiration"],
];

export function SiteHeader({ current = "" }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/">
        {site.title} <span>{site.label}</span>
      </Link>
      <nav aria-label="Main navigation">
        {sections.map(([key, href, label]) => <Link key={key} href={href} aria-current={current === key ? "page" : undefined}>{label}</Link>)}
        <a href="/stage" target="tdm155ai-stage" rel="opener">Stage ↗</a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link href="/">{site.title}</Link>
      <span>{site.term}</span>
    </footer>
  );
}
