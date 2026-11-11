import Link from "next/link";
import inventory from "../../content/inventory.json";

export function OptionLinks({ items }) {
  return (
    <ul className="option-links">
      {items.map((item) => {
        const external = /^https?:\/\//.test(item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} target={item.href === "/stage" ? "tdm155ai-stage" : external ? "_blank" : undefined} rel={item.href === "/stage" ? "opener" : external ? "noreferrer" : undefined}>
              <span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span>
              <span className="option-arrow" aria-hidden="true">↗</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// One inventory supplies both the front page and each zone's quick links.
export default function ZoneLinks({ group, heading = true }) {
  const section = inventory.groups.find((entry) => entry.id === group);
  if (!section) return null;
  return (
    <section className="option-group" id={`options-${section.id}`} aria-label={section.title}>
      {heading && <h2>{section.title}</h2>}
      <OptionLinks items={section.items} />
    </section>
  );
}
