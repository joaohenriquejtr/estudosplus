/** Shared AI contracts, prompt builders, and browser-safe response cache. */
export type LLMMessage = {
  role: "system" | "user";
  content: string;
};

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
}

type CacheEntry = { response: string; expiresAt: number };
const DEFAULT_CACHE_TTL_HOURS = 24;

const jsonOnly = "Retorne somente o objeto JSON válido. Não use markdown, bloco de código, título ou texto antes/depois do JSON.";

export function createStudySummaryRequest(content: string, subject = "Biologia"): LLMRequest {
  return {
    messages: [
      { role: "system", content: `Você é um tutor de ${subject}. Use português do Brasil, linguagem simples e direta.` },
      { role: "user", content: `Resuma o conteúdo abaixo em:\n1. Três bullets concisos com os pontos mais importantes\n2. Uma frase-chave de uma linha que capture a essência\n\nConteúdo:\n${content}\n\nFormato de resposta (JSON):\n{\n  "bullets": ["...", "...", "..."],\n  "fraseChave": "..."\n}\n\n${jsonOnly}` },
    ],
    temperature: 0.3,
    maxTokens: 500,
    jsonMode: true,
  };
}

export function createFlashcardsRequest(content: string): LLMRequest {
  return {
    messages: [
      { role: "system", content: "Você é um tutor. Use português do Brasil, linguagem simples, direta e fiel somente ao conteúdo fornecido." },
      { role: "user", content: `Com base no conteúdo abaixo, gere 5 flashcards no formato Q&A.\nCada flashcard deve ter pergunta clara e objetiva, resposta curta (1-2 frases) e explicacao baseada no conteúdo.\n\nConteúdo:\n${content}\n\nResponda em JSON:\n{\n  "flashcards": [\n    { "pergunta": "...", "resposta": "...", "explicacao": "..." },\n    { "pergunta": "...", "resposta": "...", "explicacao": "..." },\n    { "pergunta": "...", "resposta": "...", "explicacao": "..." },\n    { "pergunta": "...", "resposta": "...", "explicacao": "..." },\n    { "pergunta": "...", "resposta": "...", "explicacao": "..." }\n  ]\n}\n\n${jsonOnly}` },
    ],
    temperature: 0.3,
    maxTokens: 1_200,
    jsonMode: true,
  };
}

export type StubReference = { title: string; content: string };

export function createStubFillRequest(topic: string, subject: string, references: StubReference[]): LLMRequest {
  const context = references.map((reference, index) => `Anotação ${index + 1} — ${reference.title}:\n${reference.content}`).join("\n\n---\n\n");
  return {
    messages: [
      { role: "system", content: "Você é um tutor cuidadoso. Use português do Brasil, linguagem simples e direta." },
      { role: "user", content: `Você está ajudando um estudante a completar uma nota vazia.\nO tópico é: ${topic}\nMatéria: ${subject}\n\nBaseado APENAS nas anotações do estudante abaixo, escreva uma explicação clara e didática sobre o tópico. Não invente informações que não estejam nas anotações. Se houver lacunas, mencione que o estudante precisa complementar.\n\nAnotações relevantes:\n${context}\n\nFormato: 3-4 parágrafos em português, linguagem simples, como se fosse uma aula. Retorne somente o conteúdo da explicação, sem título, markdown ou texto introdutório.` },
    ],
    temperature: 0.3,
    maxTokens: 900,
  };
}

export type SocraticChatMessage = { role: "user" | "assistant"; content: string };

export function createSocraticChatRequest(title: string, content: string, history: SocraticChatMessage[], message: string): LLMRequest {
  const transcript = history.length > 0 ? history.map((entry) => `${entry.role === "user" ? "Estudante" : "Tutor"}: ${entry.content}`).join("\n") : "(Esta é a primeira mensagem da conversa.)";
  return {
    messages: [
      { role: "system", content: "Você é um tutor socrático. Ajude o estudante a chegar à resposta sozinho, sem dar a resposta pronta. Nunca diga ‘A resposta é’ ou ‘O correto é’. Faça perguntas que guiem o raciocínio, use analogias simples quando necessário, não corrija erros diretamente e seja encorajador. Baseie-se no conteúdo da nota e faça no máximo 3 perguntas por resposta." },
      { role: "user", content: `Nota atual: ${title}\nConteúdo:\n${content}\n\nHistórico da conversa:\n${transcript}\n\nMensagem do estudante: ${message}\n\nResponda em português do Brasil e guie o raciocínio com perguntas.` },
    ],
    temperature: 0.7,
    maxTokens: 500,
  };
}

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
  } catch { return null; }
}

export function setCachedResponse(hash: string, response: string, ttlHours = DEFAULT_CACHE_TTL_HOURS): void {
  if (typeof window === "undefined") return;
  try {
    const safeTtlHours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_CACHE_TTL_HOURS;
    window.localStorage.setItem(`ai_cache_${hash}`, JSON.stringify({ response, expiresAt: Date.now() + safeTtlHours * 60 * 60 * 1000 } satisfies CacheEntry));
  } catch { /* Storage may be unavailable. */ }
}
