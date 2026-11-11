import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

// GET /draw-a-box/gifs: the GIFs in the repo-root _media/ folder (gitignored, this computer only), as JSON
// ({ files: ["/media/gifs/popcorn.gif", ...] }), so /draw-a-box can offer them in each box's menu. The files themselves
// are served by /media/... (TR's route). Put your GIFs in _media/gifs/ (or anywhere in _media/) and reload the page.
const mediaRoot = path.join(path.dirname(/* turbopackIgnore: true */ process.cwd()), "_media");

async function walk(dir, prefix, out, depth) {
  let entries = [];
  try { entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory() && depth < 3) await walk(path.join(dir, e.name), `${prefix}${e.name}/`, out, depth + 1);
    else if (e.isFile() && path.extname(e.name).toLowerCase() === ".gif") out.push(`/media/${prefix}${e.name}`.split("/").map(encodeURIComponent).join("/"));
  }
}

export async function GET() {
  const files = [];
  await walk(mediaRoot, "", files, 0);
  return Response.json({ files: files.sort() });
}
