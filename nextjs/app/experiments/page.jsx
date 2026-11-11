import { SiteFooter, SiteHeader } from "../components/Chrome.jsx";
import ZoneLinks from "../components/ZoneLinks.jsx";
import inventory from "../../content/inventory.json";

export const metadata = { title: "Experiments" };

export default function Experiments() {
  return (
    <>
      <SiteHeader current="experiments" />
      <main id="main" className="article-shell inventory-shell">
        <header className="article-heading"><h1>Experiments</h1></header>
        <nav className="inventory-jumps" aria-label="Jump to experiments">
          {inventory.groups.map((group) => <a key={group.id} href={`#options-${group.id}`}>{group.title}</a>)}
        </nav>
        <div className="home-inventory">
          {inventory.groups.map((group) => <ZoneLinks key={group.id} group={group.id} />)}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
