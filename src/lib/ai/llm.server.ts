import type { LLMRequest, LLMResponse } from "./llm";

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
const GOOGLE_MODEL = "gemini-3.6-flash";

function getErrorMessage(provider: string, status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? `${provider} returned HTTP ${status}`;
  } catch {
    return `${provider} returned HTTP ${status}`;
  }
}

async function readJson(response: Response, provider: string): Promise<unknown> {
  const body = await response.text();
  if (!response.ok) throw new Error(getErrorMessage(provider, response.status, body));

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${provider} returned an invalid JSON response`);
  }
}

/** Calls NVIDIA NIM through its OpenAI-compatible chat completions endpoint. */
export async function callNVIDIA(req: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured");

  const response = await fetch(NVIDIA_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
        { role: "user", content: req.prompt },
      ],
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 800,
    }),
  });

  const data = (await readJson(response, "NVIDIA NIM")) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("NVIDIA NIM returned an empty response");

  return {
    text,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens ?? 0,
      completionTokens: data.usage.completion_tokens ?? 0,
    } : undefined,
  };
}

/** Calls Google AI Studio when NVIDIA NIM is unavailable. */
export async function callGoogleAI(req: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        ...(req.systemPrompt ? { system_instruction: { parts: [{ text: req.systemPrompt }] } } : {}),
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: {
          temperature: req.temperature ?? 0.3,
          maxOutputTokens: req.maxTokens ?? 800,
        },
      }),
    },
  );

  const data = (await readJson(response, "Google AI Studio")) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Google AI Studio returned an empty response");

  return {
    text,
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
    } : undefined,
  };
}

/** Uses NVIDIA NIM as the preferred provider, then Google AI Studio as fallback. */
export async function generateWithAI(req: LLMRequest): Promise<LLMResponse> {
  try {
    return await callNVIDIA(req);
  } catch (nvidiaError) {
    try {
      return await callGoogleAI(req);
    } catch (googleError) {
      const nvidiaMessage = nvidiaError instanceof Error ? nvidiaError.message : "Unknown error";
      const googleMessage = googleError instanceof Error ? googleError.message : "Unknown error";
      throw new Error(`AI generation failed. NVIDIA NIM: ${nvidiaMessage}. Google AI Studio: ${googleMessage}.`);
    }
  }
}
