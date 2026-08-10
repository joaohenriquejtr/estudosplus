/**
 * Server-side LLM client and browser-safe response cache.
 *
 * Keep imports of the generation functions inside TanStack Start server
 * handlers. The provider keys are intentionally read only at request time.
 */
export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

type CacheEntry = {
  response: string;
  expiresAt: number;
};

const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
const GOOGLE_MODEL = "gemini-3.6-flash";
const DEFAULT_CACHE_TTL_HOURS = 24;

/** Builds the standard note-summary request used by the study features. */
export function createStudySummaryRequest(content: string, subject = "Biologia"): LLMRequest {
  return {
    systemPrompt: `Você é um tutor de ${subject}. Use português do Brasil, linguagem simples e direta.`,
    prompt: `Resuma o conteúdo abaixo em:
1. Três bullets concisos com os pontos mais importantes
2. Uma frase-chave de uma linha que capture a essência

Conteúdo:
${content}

Formato de resposta (JSON):
{
  "bullets": ["...", "...", "..."],
  "fraseChave": "..."
}`,
    temperature: 0.3,
    maxTokens: 500,
  };
}

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
  if (!response.ok) {
    throw new Error(getErrorMessage(provider, response.status, body));
  }

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
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
        }
      : undefined,
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
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        ...(req.systemPrompt
          ? { system_instruction: { parts: [{ text: req.systemPrompt }] } }
          : {}),
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
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Google AI Studio returned an empty response");

  return {
    text,
    usage: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
        }
      : undefined,
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
      throw new Error(
        `AI generation failed. NVIDIA NIM: ${nvidiaMessage}. Google AI Studio: ${googleMessage}.`,
      );
    }
  }
}

/** Creates the SHA-256 key used by the local response cache. */
export async function hashPrompt(prompt: string): Promise<string> {
  const data = new TextEncoder().encode(prompt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCachedResponse(hash: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const rawEntry = window.localStorage.getItem(`ai_cache_${hash}`);
    if (!rawEntry) return null;

    const entry = JSON.parse(rawEntry) as CacheEntry;
    if (!entry.response || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
      window.localStorage.removeItem(`ai_cache_${hash}`);
      return null;
    }

    return entry.response;
  } catch {
    return null;
  }
}

export function setCachedResponse(
  hash: string,
  response: string,
  ttlHours = DEFAULT_CACHE_TTL_HOURS,
): void {
  if (typeof window === "undefined") return;

  try {
    const safeTtlHours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_CACHE_TTL_HOURS;
    const entry: CacheEntry = {
      response,
      expiresAt: Date.now() + safeTtlHours * 60 * 60 * 1000,
    };
    window.localStorage.setItem(`ai_cache_${hash}`, JSON.stringify(entry));
  } catch {
    // Storage can be unavailable (private browsing, quota limits); generation still works.
  }
}
