import Link from "next/link";

// The /launch pages, as tabs.
const tabs = [
  ["/launch/inputs", "0 · Inputs: is it working?"],
  ["/launch", "1 · Buttons and keys"],
  ["/launch/midi", "2 · MIDI controller"],
  ["/launch/mpe", "2b · Seaboard (MPE)"],
  ["/launch/cue-list", "3 · Cue list (Go)"],
  ["/launch/xy", "4 · XY pad (filter)"],
  ["/launch/hand", "4b · Hand launch"],
  ["/launch/live-score", "4c · Live score"],
  ["/launch/shader", "5 · Shader"],
  ["/launch/kaleidoscope", "5b · Kaleidoscope"],
  ["/launch/particles", "5c · Particles"],
  ["/launch/spectrogram", "6 · Spectrogram"],
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
