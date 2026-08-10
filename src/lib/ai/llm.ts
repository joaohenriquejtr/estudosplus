/**
 * Shared AI types, prompt builders, and browser-safe response cache.
 * Provider calls live in llm.server.ts so credentials never reach the client.
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
