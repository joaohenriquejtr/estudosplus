import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findSemanticContext } from "@/lib/ai/context.server";
import { syncNoteEmbedding } from "@/lib/ai/embeddings.server";

export const syncContentCardEmbedding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ noteId: z.string().uuid(), content: z.string().trim().min(1).max(60_000) }))
  .handler(async ({ data, context }) => {
    await syncNoteEmbedding(data.noteId, data.content, context.userId);
    return { ok: true };
  });

export const getSemanticContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ topic: z.string().trim().min(1).max(240), subjectId: z.string().uuid() }))
  .handler(async ({ data, context }) => ({ references: await findSemanticContext(data.topic, data.subjectId, context.userId) }));
