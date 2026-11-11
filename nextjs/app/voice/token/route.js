import { env } from "../../../lib/keys.mjs";

export const dynamic = "force-dynamic";

// POST /voice/token: mint a short-lived OpenAI client secret for one realtime transcription session, so the browser
// can stream the microphone to OpenAI directly (WebRTC) without ever seeing the real key, which stays in the repo's
// root .env. Body (all optional): { keywords: ["moon", ...], prompt: "...", delay: "minimal" | "low" | "medium" }.
const DELAYS = ["minimal", "low", "medium", "high", "xhigh"];

export async function POST(request) {
  const key = await env("OPENAI_API_KEY");
  if (!key) return Response.json({ error: "No OPENAI_API_KEY in the repo's root .env." }, { status: 503 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Wrong origin." }, { status: 403 });

  let body = {};
  try { body = await request.json(); } catch {}
  const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
    .map((k) => String(k).replace(/[<>\r\n]/g, " ").trim()).filter(Boolean).slice(0, 100);
  const transcription = { model: "gpt-live-transcribe", languages: ["en"], delay: DELAYS.includes(body.delay) ? body.delay : "low" };
  if (keywords.length) transcription.keywords = keywords;
  if (typeof body.prompt === "string" && body.prompt.trim()) transcription.prompt = body.prompt.slice(0, 1000);

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: { type: "transcription", audio: { input: { transcription, turn_detection: null } } },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return Response.json({ error: data?.error?.message || `OpenAI said ${response.status}` }, { status: response.status });
  return Response.json({ value: data.value, expires_at: data.expires_at, model: transcription.model, delay: transcription.delay }, { headers: { "Cache-Control": "no-store" } });
}
