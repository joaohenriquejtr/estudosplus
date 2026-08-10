import { supabaseAdmin } from "@/integrations/supabase/client.server";

const JINA_ENDPOINT = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v2-base-code";
const EMBEDDING_DIMENSIONS = 768;

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY não configurada");
  const response = await fetch(JINA_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: [text.slice(0, 30_000)], model: JINA_MODEL, normalized: true }),
  });
  if (!response.ok) throw new Error(`Jina AI retornou HTTP ${response.status}`);
  const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS || !embedding.every(Number.isFinite)) {
    throw new Error("Jina AI retornou um embedding inválido");
  }
  return embedding;
}

export async function syncNoteEmbedding(noteId: string, content: string, userId: string): Promise<void> {
  const embedding = await generateEmbedding(content);
  const vector = `[${embedding.join(",")}]`;
  const { error } = await supabaseAdmin.from("content_cards").update({ embedding: vector } as never).eq("id", noteId).eq("user_id", userId);
  if (error) throw error;
}
