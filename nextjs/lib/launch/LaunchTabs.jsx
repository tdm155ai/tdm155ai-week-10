import Link from "next/link";

// The /launch pages, as tabs.
const tabs = [
  ["/launch", "1 · Buttons and keys"],
  ["/launch/midi", "2 · MIDI controller"],
  ["/launch/cue-list", "3 · Cue list (Go)"],
  ["/launch/xy", "4 · XY pad (filter)"],
  ["/launch/shader", "5 · Shader (graphics)"],
  ["/launch/hello", "In one file"],
  ["/docs/launch", "How-to"],
];

export default function LaunchTabs({ current }) {
  return (
    <nav className="ctl-tabs" aria-label="Launch pages">
      {tabs.map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
