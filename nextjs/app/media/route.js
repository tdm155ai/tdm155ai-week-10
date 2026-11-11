import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

// GET /media: the sound and video files in the repo-root _media/ folder, as JSON ({ files: ["/media/xy/song.mp3", ...] }),
// so a page can offer them in a menu. Names only; the files themselves come from /media/... (the route beside this).
const mediaRoot = path.join(path.dirname(/* turbopackIgnore: true */ process.cwd()), "_media");
const playable = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".mp4", ".m4v", ".mov", ".webm"]);

async function walk(dir, prefix, out, depth) {
  let entries = [];
  try { entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory() && depth < 3) await walk(path.join(dir, e.name), `${prefix}${e.name}/`, out, depth + 1);
    else if (e.isFile() && playable.has(path.extname(e.name).toLowerCase())) out.push(`/media/${prefix}${e.name}`.split("/").map(encodeURIComponent).join("/").replace(/^%2F/, "/"));
  }
}

export async function GET() {
  const files = [];
  await walk(mediaRoot, "", files, 0);
  return Response.json({ files: files.sort() });
}
