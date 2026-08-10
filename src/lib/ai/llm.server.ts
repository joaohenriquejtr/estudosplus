import type { LLMRequest, LLMResponse } from "./llm";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const NVIDIA_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const NVIDIA_MODEL = "deepseek-ai/deepseek-v4";
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

class ProviderError extends Error {
  constructor(readonly provider: "Groq" | "NVIDIA", readonly retryable: boolean, message: string) {
    super(message);
  }
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const retryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;

async function parseResponse(response: Response, provider: "Groq" | "NVIDIA"): Promise<LLMResponse> {
  const body = await response.text();
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message ?? parsed.message ?? message;
    } catch { /* Use HTTP status when the provider response is not JSON. */ }
    throw new ProviderError(provider, retryableStatus(response.status), message);
  }
  try {
    const data = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty completion");
    return { text, usage: data.usage ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 } : undefined };
  } catch {
    throw new ProviderError(provider, true, "Resposta inválida do provedor");
  }
}

async function requestWithRetry(provider: "Groq" | "NVIDIA", endpoint: string, apiKey: string | undefined, model: string, req: LLMRequest): Promise<LLMResponse> {
  if (!apiKey) throw new ProviderError(provider, false, "Chave de API não configurada");
  for (let retry = 0; retry <= RETRY_DELAYS_MS.length; retry += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: req.messages, temperature: req.temperature ?? 0.3, max_tokens: req.maxTokens ?? 2_048, ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
        signal: AbortSignal.timeout(30_000),
      });
      return await parseResponse(response, provider);
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : new ProviderError(provider, true, error instanceof Error ? error.message : "Erro de rede");
      if (!providerError.retryable || retry === RETRY_DELAYS_MS.length) throw providerError;
      await sleep(RETRY_DELAYS_MS[retry]);
    }
  }
  throw new ProviderError(provider, true, "Tentativas esgotadas");
}

export const callGroq = (req: LLMRequest) => requestWithRetry("Groq", GROQ_ENDPOINT, process.env.GROQ_API_KEY, GROQ_MODEL, req);
export const callNVIDIA = (req: LLMRequest) => requestWithRetry("NVIDIA", NVIDIA_ENDPOINT, process.env.NVIDIA_API_KEY, NVIDIA_MODEL, req);

export async function generateWithAI(req: LLMRequest): Promise<LLMResponse> {
  try {
    return await callGroq(req);
  } catch (groqError) {
    if (!(groqError instanceof ProviderError) || !groqError.retryable) {
      console.error("Groq failed", groqError);
      throw new Error("A IA está temporariamente indisponível. Tente novamente em alguns instantes.");
    }
    console.error("Groq failed, trying NVIDIA", groqError.message);
    try { return await callNVIDIA(req); }
    catch (nvidiaError) {
      console.error("NVIDIA fallback failed", nvidiaError);
      throw new Error("A IA está temporariamente indisponível. Tente novamente em alguns instantes.");
    }
  }
}
