import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../../../components/Chrome.jsx";
import Markdown from "../../../components/Markdown.jsx";
import "./making-of.css";

// /track/horror/making-of: how the horror scene was built. The text is ./making-of.md (edit it while the app runs);
// the flow diagram below goes where the Markdown says <!-- pipeline -->.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Making of: the live horror scene",
  description: "How /track/horror was built: the prompts that shaped it, how the picture and the voice are made, what went wrong along the way, and what to change.",
};

const FILE = path.join(/* turbopackIgnore: true */ process.cwd(), "app", "track", "horror", "making-of", "making-of.md");

// The four chains in the tab: [name, [[step, detail], …]].
const FLOWS = [
  ["Picture", [["Camera"], ["Trackers", "face · hands · person"], ["three.js", "cutout · mask · ghost"], ["Film", "flicker · tear · grain"], ["Stage"]]],
  ["Voice", [["Mic", "a Scarlett, either input"], ["Catch", "waits for a pause"], ["Voice filter", "pitch · growl · wobble · echo · reverb"], ["Mix", "+ drone and scares"], ["Speakers"]]],
  ["Ear", [["Mic"], ["Speech recognition", "Chrome"], ["Script follower", "lib/voice/follow.js"], ["Cues", "voice · mask · scares"]]],
  ["Record", [["Stage + mix"], ["MediaRecorder", "30 fps, 8 Mbps"], ["Take", "MP4 or WebM"], ["Plays below the stage"]]],
];

function Pipeline() {
  return (
    <figure className="mo-flows">
      <ol>
        {FLOWS.map(([name, steps]) => (
          <li className="mo-flow" key={name}>
            <span className="mo-name">{name}</span>
            <ol className="mo-steps">
              {steps.map(([step, detail]) => (
                <li className="mo-step" key={step}>
                  <span className="mo-box">{step}{detail && <small>{detail}</small>}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <figcaption>The cues the ear fires change the voice filter and the picture; the recorder takes the stage and the mix.</figcaption>
    </figure>
  );
}

// The H2s, as links above the text (the same ids rehype-slug gives them).
function contents(markdown) {
  return [...markdown.replace(/```[\s\S]*?```/g, "").matchAll(/^##\s+(.+)$/gm)].map((m) => {
    const text = m[1].replace(/[*_`]/g, "").trim();
    return { text, id: text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/ /g, "-") };
  });
}

export default async function MakingOfPage() {
  const markdown = await readFile(FILE, "utf8");
  const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? metadata.title;
  const [before, after = ""] = markdown.split(/^<!--\s*pipeline\s*-->\s*$/m);
  const sections = contents(markdown);

  return (
    <>
      <SiteHeader current="track" />
      <main id="main" className="article-shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="breadcrumb-step"><span>/</span><Link href="/track">Track</Link></span>
          <span className="breadcrumb-step"><span>/</span><Link href="/track/horror">Horror</Link></span>
          <span>/</span><span>Making of</span>
        </nav>
        <header className="article-heading">
          <h1>{title}</h1>
          <p className="lede">{metadata.description}</p>
          <p className="updated"><Link href="/track/horror">Open the horror scene →</Link></p>
        </header>
        <nav className="page-contents" aria-label="On this page">
          <p className="eyebrow">On this page</p>
          <ol>{sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.text}</a></li>)}</ol>
        </nav>
        <article className="prose mo-prose">
          <Markdown doc={{ content: before, dir: "" }} />
          {after && <Pipeline />}
          {after && <Markdown doc={{ content: after, dir: "" }} />}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
