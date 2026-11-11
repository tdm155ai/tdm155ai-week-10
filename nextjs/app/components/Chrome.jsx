import Link from "next/link";
import { site } from "../../lib/content.mjs";

// Three destinations, matching the landing page.
const sections = [
  ["inspiration", "/inspiration", "Shows"],
  ["inputs", "/inputs-outputs", "Inputs & outputs"],
  ["experiments", "/experiments", "Experiments"],
];

export function SiteHeader({ current = "" }) {
  const active = ["launch", "voice", "track", "draw"].includes(current) ? "experiments" : current;
  return (
    <header className="site-header">
      <Link className="wordmark" href="/">
        {site.title} <span>{site.label}</span>
      </Link>
      <nav aria-label="Main navigation">
        {sections.map(([key, href, label]) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
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
