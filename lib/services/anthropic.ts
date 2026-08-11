const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

interface GenerateOptions {
  system?: string;
  maxTokens?: number;
}

class AnthropicNotConfiguredError extends Error {
  constructor() {
    super("AI features require ANTHROPIC_API_KEY to be configured.");
    this.name = "AnthropicNotConfiguredError";
  }
}

async function callClaude(userPrompt: string, options: GenerateOptions = {}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options.maxTokens ?? 1500,
      system: options.system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  return textBlock?.text ?? "";
}

/** Plain text generation — for the chat assistant and narrative summaries. */
export async function generateText(prompt: string, system?: string, maxTokens?: number): Promise<string> {
  return callClaude(prompt, { system, maxTokens });
}

/**
 * Generates structured JSON. Instructs the model to return only JSON (no
 * prose, no markdown fences) and parses the result. Throws if the model's
 * response isn't valid JSON so callers can surface a clear error rather than
 * silently saving garbage.
 */
export async function generateJson<T>(prompt: string, system: string, maxTokens?: number): Promise<T> {
  const strictSystem = `${system}\n\nCRITICAL: Respond with ONLY a single valid JSON object. No prose, no explanation, no markdown code fences — just the raw JSON.`;
  const raw = await callClaude(prompt, { system: strictSystem, maxTokens });
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("The AI returned a response that couldn't be parsed. Please try again.");
  }
}

export { AnthropicNotConfiguredError };
