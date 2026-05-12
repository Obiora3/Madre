const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_SYSTEM_PROMPT =
  "You are AgencyFlow's AI assistant. Respond concisely and professionally.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not configured for this deployment."
    });
  }

  const { prompt, systemPrompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "A prompt is required." });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1000,
        system: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data?.error?.message || `Anthropic API error ${upstream.status}`
      });
    }

    const text =
      data?.content?.find((part) => part?.type === "text")?.text ||
      data?.content?.[0]?.text;

    if (!text) {
      return res.status(502).json({ error: "Anthropic returned an empty response." });
    }

    return res.status(200).json({ text });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Unable to reach Anthropic."
    });
  }
}
