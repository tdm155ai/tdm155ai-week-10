import Link from "next/link";

// The /voice pages, as tabs.
const tabs = [
  ["/voice", "1 · Say a word"],
  ["/voice/script", "2 · Follow a script"],
  ["/voice/compare", "3 · Compare engines"],
  ["/voice/semantic", "4 · By topic (AI)"],
  ["/docs/voice", "How-to"],
];

export default function VoiceTabs({ current }) {
  return (
    <nav className="ctl-tabs" aria-label="Voice pages">
      {tabs.map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
