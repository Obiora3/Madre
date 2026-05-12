// ─── AI CALL ──────────────────────────────────────────────────────────────────
export async function callClaude(prompt, systemPrompt = "") {
  let resp;
  try {
    resp = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemPrompt })
    });
  } catch (networkErr) {
    throw new Error("Network error — check your connection and try again.");
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const msg = body?.error?.message || body?.error || `API error ${resp.status}`;
    throw new Error(msg);
  }
  const data = await resp.json();
  const text = data.text;
  if (!text) throw new Error("The AI returned an empty response. Please try again.");
  return text;
}
