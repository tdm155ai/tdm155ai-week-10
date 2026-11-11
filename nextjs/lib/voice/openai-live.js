// OpenAI realtime transcription (gpt-live-transcribe) from the browser, over WebRTC. The page asks our server
// (/voice/token) for a short-lived client secret, so the real key never reaches the browser, then streams an audio
// track straight to OpenAI and gets transcript deltas back on a data channel while you talk.
//
// gpt-live-transcribe doesn't detect the end of a turn itself, so this does it: a small voice-activity detector
// (loudness over a threshold) commits the audio after a pause, which makes OpenAI send the final text for that turn.
// Docs: https://developers.openai.com/api/docs/guides/realtime-transcription
//
//   const live = await startOpenAILive({ stream, keywords: ["moon"], onResult: ({ index, text, final }) => ... });
//   live.stop();

export async function startOpenAILive({ stream, keywords = [], prompt = "", delay = "low", silenceMs = 550, maxTurnMs = 8000, threshold = 0.012, onResult, onState, onError, onLevel } = {}) {
  onState?.("getting a token");
  const tokenResponse = await fetch("/voice/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords, prompt, delay }),
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.value) throw new Error(token.error || "Couldn't get a token from /voice/token");

  onState?.("connecting");
  const pc = new RTCPeerConnection();
  for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
  const dc = pc.createDataChannel("oai-events");

  const texts = new Map(); // item_id -> text so far
  const order = new Map(); // item_id -> a number, in the order items appeared
  const indexOf = (id) => { if (!order.has(id)) order.set(id, order.size); return order.get(id); };

  dc.addEventListener("message", ({ data }) => {
    let event;
    try { event = JSON.parse(data); } catch { return; }
    const at = performance.now();
    if (event.type === "conversation.item.input_audio_transcription.delta") {
      const text = (texts.get(event.item_id) || "") + (event.delta || "");
      texts.set(event.item_id, text);
      onResult?.({ index: indexOf(event.item_id), text, final: false, session: "openai", at });
    } else if (event.type === "conversation.item.input_audio_transcription.completed") {
      texts.set(event.item_id, event.transcript || "");
      onResult?.({ index: indexOf(event.item_id), text: event.transcript || "", final: true, session: "openai", at });
    } else if (event.type === "error") {
      // Committing an empty or tiny buffer is harmless; anything else is worth showing.
      const message = event.error?.message || "error";
      if (!/buffer too small|empty/i.test(message)) onError?.(new Error(`OpenAI: ${message}`));
    } else if (event.type === "session.created" || event.type === "transcription_session.created" || event.type === "session.updated") {
      onState?.("listening");
    }
  });
  dc.addEventListener("open", () => onState?.("listening"));
  dc.addEventListener("close", () => onState?.("closed"));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    body: offer.sdp,
    headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
  });
  const answer = await sdpResponse.text();
  if (!sdpResponse.ok) { pc.close(); throw new Error(`OpenAI call failed (${sdpResponse.status}): ${answer.slice(0, 200)}`); }
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  // Voice-activity detection: commit after `silenceMs` of quiet following speech, or every `maxTurnMs` of talking.
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let speaking = false, lastLoud = 0, turnStart = 0, timer = null;
  const commit = () => { if (dc.readyState === "open") dc.send(JSON.stringify({ type: "input_audio_buffer.commit" })); };
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    onLevel?.(rms);
    const now = performance.now();
    if (rms > threshold) { lastLoud = now; if (!speaking) { speaking = true; turnStart = now; } }
    if (speaking && now - lastLoud > silenceMs) { speaking = false; commit(); }
    else if (speaking && now - turnStart > maxTurnMs) { turnStart = now; commit(); }
  };
  timer = setInterval(tick, 50);

  const stop = () => {
    clearInterval(timer);
    try { commit(); } catch {}
    try { source.disconnect(); ctx.close(); } catch {}
    setTimeout(() => { try { dc.close(); pc.close(); } catch {} onState?.("stopped"); }, 600);
  };
  return { stop, commit, model: token.model, delay: token.delay };
}
