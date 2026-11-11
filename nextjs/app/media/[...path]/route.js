import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

// /media/... serves the repo-root _media/ folder (gitignored: your own clips, sounds, images stay on your machine).
// /media/clips/rain.mp4 is _media/clips/rain.mp4. Nothing outside _media/ is reachable. Supports Range requests so
// long videos seek.
const mediaRoot = path.join(path.dirname(/* turbopackIgnore: true */ process.cwd()), "_media");

const types = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".flac": "audio/flac",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8",
};

function resolve(segments) {
  const parts = segments.map((s) => decodeURIComponent(s));
  if (parts.some((p) => p.includes("\0"))) return null;
  const file = path.resolve(mediaRoot, ...parts);
  return file.startsWith(mediaRoot + path.sep) ? file : null;
}

export async function GET(request, { params }) {
  const { path: segments } = await params;
  const file = resolve(segments);
  const type = file && types[path.extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  let info;
  try {
    info = await stat(/* turbopackIgnore: true */ file);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const size = info.size;
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(/* turbopackIgnore: true */ file, { start, end }));
    return new Response(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(createReadStream(/* turbopackIgnore: true */ file));
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
