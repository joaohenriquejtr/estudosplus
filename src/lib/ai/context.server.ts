import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateEmbedding } from "./embeddings.server";
import type { StubReference } from "./llm";

export async function findSemanticContext(topic: string, subjectId: string, userId: string): Promise<StubReference[]> {
  const embedding = await generateEmbedding(topic);
  const { data, error } = await supabaseAdmin.rpc("match_content_cards" as never, {
    query_embedding: `[${embedding.join(",")}]`, match_threshold: 0.7, match_count: 3, p_subject_id: subjectId, p_user_id: userId,
  } as never);
  if (error) throw error;
  return ((data ?? []) as Array<{ title: string | null; content: string | null }>)
    .filter((note) => note.content?.trim())
    .map((note) => ({ title: note.title?.trim() || "Sem título", content: note.content!.trim() }));
}
