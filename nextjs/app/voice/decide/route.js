import { env } from "../../../lib/keys.mjs";

export const dynamic = "force-dynamic";

// POST /voice/decide: the semantic lane. Given the last few sentences someone said and a list of topics, a small fast
// model decides which topic (if any) the speaker is on now, and which one seems to be coming, as structured JSON.
// Body: { transcript, topics: [{ id, about }], current }. Returns { cue, confidence, arm, reason, ms, model }.
// The key stays here on the server (the repo's root .env).
const MODEL = "gpt-6-luna"; // OpenAI's most efficient model (checked in OpenAI's model docs, 2026-11-11)

export async function POST(request) {
  const key = await env("OPENAI_API_KEY");
  if (!key) return Response.json({ error: "No OPENAI_API_KEY in the repo's root .env." }, { status: 503 });
  let body = {};
  try { body = await request.json(); } catch {}
  const topics = (Array.isArray(body.topics) ? body.topics : []).slice(0, 40).map((t) => ({ id: String(t.id), about: String(t.about || "").slice(0, 300) }));
  const transcript = String(body.transcript || "").slice(-1500);
  if (!topics.length || !transcript.trim()) return Response.json({ cue: "none", confidence: 0, arm: "none", reason: "nothing to judge yet" });
  const ids = [...topics.map((t) => t.id), "none"];

  const instructions = [
    "You are the show-control operator for a live talk or reading. Pictures and sounds are cued by topic.",
    "Read the latest transcript (it is machine transcription: expect misheard words) and decide:",
    "cue: the topic the speaker is talking about right now, or none if no topic clearly fits. Judge mainly from the last sentence or two.",
    "confidence: 0 to 1, how sure you are of cue.",
    "arm: a topic the speaker seems to be heading toward next but has not reached yet, or none.",
    "reason: at most 12 words.",
    `The topic currently on stage is: ${body.current || "none"}. Only change it when the speaker has clearly moved on.`,
  ].join("\n");
  const input = `Topics:\n${topics.map((t) => `- ${t.id}: ${t.about}`).join("\n")}\n\nTranscript (latest last):\n${transcript}`;

  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: "none" },
      instructions,
      input,
      max_output_tokens: 120,
      text: {
        format: {
          type: "json_schema",
          name: "cue_decision",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["cue", "confidence", "arm", "reason"],
            properties: {
              cue: { type: "string", enum: ids },
              confidence: { type: "number" },
              arm: { type: "string", enum: ids },
              reason: { type: "string" },
            },
          },
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return Response.json({ error: data?.error?.message || `OpenAI said ${response.status}` }, { status: response.status });
  const text = data.output_text || (data.output || []).flatMap((o) => o.content || []).find((c) => c.type === "output_text")?.text || "{}";
  let decision = {};
  try { decision = JSON.parse(text); } catch { decision = { cue: "none", confidence: 0, arm: "none", reason: "unreadable answer" }; }
  return Response.json({ ...decision, ms: Date.now() - started, model: MODEL });
}
