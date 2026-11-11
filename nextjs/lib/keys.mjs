import { readFile } from "node:fs/promises";
import path from "node:path";

// API keys for the machine's server routes. A key set in the environment wins; otherwise it comes from the repo's
// nextjs/.env.local, then the repo's root .env, read on every call so local file edits apply without a restart. Keys stay on
// the server: nothing here is ever sent to the browser.
const repoRoot = path.dirname(/* turbopackIgnore: true */ process.cwd());

function parse(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

export async function env(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  for (const file of [path.join(process.cwd(), ".env.local"), path.join(repoRoot, ".env")]) {
    try {
      const value = parse(await readFile(/* turbopackIgnore: true */ file, "utf8"))[name]?.trim();
      if (value) return value;
    } catch {}
  }
  return "";
}
