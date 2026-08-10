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
}

Retorne somente o objeto JSON válido. Não use markdown, bloco de código, título ou texto antes/depois do JSON.`,
    temperature: 0.3,
    maxTokens: 500,
  };
}

/** Builds the standard flashcard-generation request for a note. */
export function createFlashcardsRequest(content: string): LLMRequest {
  return {
    systemPrompt: "Você é um tutor. Use português do Brasil, linguagem simples, direta e fiel somente ao conteúdo fornecido.",
    prompt: `Com base no conteúdo abaixo, gere 5 flashcards no formato Q&A.
Cada flashcard deve ter:
- pergunta: clara e objetiva
- resposta: curta (1-2 frases)
- explicacao: por que esta é a resposta correta, usando o conteúdo fornecido

Conteúdo:
${content}

Responda em JSON:
{
  "flashcards": [
    { "pergunta": "...", "resposta": "...", "explicacao": "..." },
    { "pergunta": "...", "resposta": "...", "explicacao": "..." },
    { "pergunta": "...", "resposta": "...", "explicacao": "..." },
    { "pergunta": "...", "resposta": "...", "explicacao": "..." },
    { "pergunta": "...", "resposta": "...", "explicacao": "..." }
  ]
}

Retorne somente o objeto JSON válido. Não use markdown, bloco de código, título ou texto antes/depois do JSON.`,
    temperature: 0.4,
    maxTokens: 1_200,
  };
}

export type StubReference = {
  title: string;
  content: string;
};

export type SocraticChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Builds a note-grounded prompt for the Socratic tutor. */
export function createSocraticChatRequest(
  title: string,
  content: string,
  history: SocraticChatMessage[],
  message: string,
): LLMRequest {
  const transcript = history.length > 0
    ? history.map((entry) => `${entry.role === "user" ? "Estudante" : "Tutor"}: ${entry.content}`).join("\n")
    : "(Esta é a primeira mensagem da conversa.)";

  return {
    systemPrompt: `Você é um tutor socrático. Seu objetivo é AJUDAR o estudante a CHEGAR à resposta sozinho, NÃO dar a resposta pronta.

Regras:
1. NUNCA diga "A resposta é..." ou "O correto é..."
2. Faça PERGUNTAS que guiem o raciocínio
3. Use analogias simples quando o estudante travar
4. Se o estudante errar, não corrija diretamente — pergunte "O que te levou a pensar assim?"
5. Baseie-se no conteúdo da nota fornecido como contexto
6. Seja encorajador e paciente
7. Máximo 3 perguntas por resposta sua`,
    prompt: `Nota atual: ${title}
Conteúdo:
${content}

Histórico da conversa:
${transcript}

Mensagem do estudante: ${message}

Responda em português do Brasil. Guie o raciocínio com perguntas e não entregue a resposta pronta.`,
    temperature: 0.5,
    maxTokens: 500,
  };
}

/** Builds a constrained request to turn mentions of a stub into an editable draft. */
export function createStubFillRequest(
  topic: string,
  subject: string,
  references: StubReference[],
): LLMRequest {
  const context = references
    .map((reference, index) => `Anotação ${index + 1} — ${reference.title}:\n${reference.content}`)
    .join("\n\n---\n\n");

  return {
    systemPrompt: "Você é um tutor cuidadoso. Use português do Brasil, linguagem simples e direta.",
    prompt: `Você está ajudando um estudante a completar uma nota vazia.
O tópico é: ${topic}
Matéria: ${subject}

Baseado APENAS nas anotações do estudante abaixo, escreva uma explicação clara e didática sobre o tópico.
Não invente informações que não estejam nas anotações. Se houver lacunas, mencione que o estudante precisa complementar.

Anotações relevantes:
${context}

Formato: 3-4 parágrafos em português, linguagem simples, como se fosse uma aula. Retorne somente o conteúdo da explicação, sem título, markdown ou texto introdutório.`,
    temperature: 0.3,
    maxTokens: 900,
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
