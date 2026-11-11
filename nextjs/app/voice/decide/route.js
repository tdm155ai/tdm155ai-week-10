import { env } from "../../../lib/keys.mjs";

export const dynamic = "force-dynamic";

// POST /voice/decide: the semantic lane. Given the last few sentences someone said and a list of topics, a small fast
// model decides which topic (if any) the speaker is on now, and which one seems to be coming, as structured JSON.
// Body: { transcript, topics: [{ id, about }], current, model? }. Returns { cue, confidence, arm, reason, ms, model, provider }.
// GET /voice/decide: which provider and model will answer, and the models the page may choose from (no key needed).
//
// Provider: OpenRouter when OPENROUTER_API_KEY is set (nextjs/.env.local or the repo's root .env), otherwise OpenAI with
// OPENAI_API_KEY. Keys stay here on the server. OpenRouter's model: the page's choice if it's in MODELS below, else
// OPENROUTER_DECIDE_MODEL, else the first in MODELS. Each was checked in OpenRouter's catalog on 2026-11-11 to support
// structured outputs (response_format json_schema) and reasoning_effort.
// Order = default first: in a test on 2026-11-11 (four lecture sentences each, through this route) Haiku and Gemini
// Flash-Lite got all four right in about 0.9 s; GPT-6 Luna all four in 1.4–2.3 s; GLM-5.3 Flash missed one.
const MODELS = [
  { id: "anthropic/claude-haiku-5.5", note: "Anthropic's fast model ($0.10 / $0.50 per 1M tokens), ~0.9 s" },
  { id: "google/gemini-3.1-flash-lite", note: "Google's light model ($0.25 / $1.50), ~0.9 s" },
  { id: "openai/gpt-6-luna", note: "OpenAI's most efficient model ($0.10 / $0.50), ~1.8 s" },
  { id: "z-ai/glm-5.3-flash", note: "Z.ai, cheapest ($0.04 / $0.08), ~1 s, less accurate" },
];
const OPENAI_MODEL = "gpt-6-luna"; // OpenAI direct (checked in OpenAI's model docs, 2026-11-11)

async function provider(requested) {
  const openrouter = await env("OPENROUTER_API_KEY");
  if (openrouter) {
    const fallback = (await env("OPENROUTER_DECIDE_MODEL")) || MODELS[0].id;
    const model = MODELS.some((m) => m.id === requested) ? requested : fallback;
    return { name: "openrouter", key: openrouter, model };
  }
  const openai = await env("OPENAI_API_KEY");
  if (openai) return { name: "openai", key: openai, model: OPENAI_MODEL };
  return null;
}

export async function GET() {
  const p = await provider();
  return Response.json({ provider: p?.name || "none", model: p?.model || null, models: p?.name === "openrouter" ? MODELS : [] });
}

const schemaFor = (ids) => ({
  type: "object",
  additionalProperties: false,
  required: ["cue", "confidence", "arm", "reason"],
  properties: {
    cue: { type: "string", enum: ids },
    confidence: { type: "number" },
    arm: { type: "string", enum: ids },
    reason: { type: "string" },
  },
});

async function askOpenRouter(p, instructions, input, schema) {
  const send = (reasoning) => fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json", "X-OpenRouter-Title": "TDM 155AI week 10" },
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: "system", content: instructions }, { role: "user", content: input }],
      response_format: { type: "json_schema", json_schema: { name: "cue_decision", strict: true, schema } },
      provider: { require_parameters: true }, // only providers that honor the schema
      max_tokens: 200,
      ...(reasoning ? { reasoning: { effort: reasoning } } : {}),
    }),
  });
  let response = await send("none");
  let data = await response.json().catch(() => ({}));
  if (!response.ok && /reason/i.test(data?.error?.message || "")) { // a model that can't switch reasoning off
    response = await send("minimal");
    data = await response.json().catch(() => ({}));
  }
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || `OpenRouter said ${response.status}`), { status: response.status });
  return { text: data.choices?.[0]?.message?.content || "{}", model: data.model || p.model };
}

async function askOpenAI(p, instructions, input, schema) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.model, reasoning: { effort: "none" }, instructions, input, max_output_tokens: 120,
      text: { format: { type: "json_schema", name: "cue_decision", strict: true, schema } },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || `OpenAI said ${response.status}`), { status: response.status });
  const text = data.output_text || (data.output || []).flatMap((o) => o.content || []).find((c) => c.type === "output_text")?.text || "{}";
  return { text, model: p.model };
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const p = await provider(body.model);
  if (!p) return Response.json({ error: "No OPENROUTER_API_KEY or OPENAI_API_KEY (nextjs/.env.local or the repo's root .env)." }, { status: 503 });
  const topics = (Array.isArray(body.topics) ? body.topics : []).slice(0, 40).map((t) => ({ id: String(t.id), about: String(t.about || "").slice(0, 300) }));
  const transcript = String(body.transcript || "").slice(-1500);
  if (!topics.length || !transcript.trim()) return Response.json({ cue: "none", confidence: 0, arm: "none", reason: "nothing to judge yet", provider: p.name, model: p.model });
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
  try {
    const { text, model } = await (p.name === "openrouter" ? askOpenRouter : askOpenAI)(p, instructions, input, schemaFor(ids));
    let decision = {};
    try { decision = JSON.parse(text); } catch { decision = { cue: "none", confidence: 0, arm: "none", reason: "unreadable answer" }; }
    if (!ids.includes(decision.cue)) decision.cue = "none"; // in case a provider treats the schema as a hint
    if (!ids.includes(decision.arm)) decision.arm = "none";
    return Response.json({ ...decision, ms: Date.now() - started, model, provider: p.name });
  } catch (error) {
    return Response.json({ error: error.message, provider: p.name, model: p.model }, { status: error.status || 502 });
  }
}
