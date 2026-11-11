import Link from "next/link";
import { SiteHeader } from "../../components/Chrome.jsx";
import { fellows } from "./fellows.js";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Track: fellows' experiments" };

export default function FellowsPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <div className="cv-page">
          <div className="cv-head">
            <p className="eyebrow">Track · fellows&apos; experiments</p>
            <h1>What the fellows made.</h1>
            <p className="cv-lede">Hand-tracking instruments and cameras made by Learning Lab fellows. Play them, then read the code. Each needs Chrome and a camera. More about them: <Link href="/fellows">/fellows</Link>.</p>
          </div>
          <div className="fellow-list">
            {fellows.map((f) => (
              <Link key={f.slug} href={`/track/fellows/${f.slug}`} className="fellow-card">
                <strong>{f.title}</strong>
                <span>{f.what}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
