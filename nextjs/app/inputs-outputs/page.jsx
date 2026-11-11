import { SiteFooter, SiteHeader } from "../components/Chrome.jsx";
import { OptionLinks } from "../components/ZoneLinks.jsx";
import inventory from "../../content/inventory.json";

export const metadata = { title: "Inputs & outputs" };

export default function InputsOutputs() {
  return (
    <>
      <SiteHeader current="inputs" />
      <main id="main" className="article-shell inventory-shell">
        <header className="article-heading"><h1>Inputs &amp; outputs</h1></header>
        <div className="input-output-map">
          <section className="home-category" aria-labelledby="input-heading">
            <h2 id="input-heading">Inputs</h2>
            <p>See what the computer receives.</p>
            <OptionLinks items={inventory.inputs} />
          </section>
          <section className="home-category" aria-labelledby="output-heading">
            <h2 id="output-heading">Outputs</h2>
            <p>Choose what happens in the room.</p>
            <OptionLinks items={inventory.outputs} />
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
