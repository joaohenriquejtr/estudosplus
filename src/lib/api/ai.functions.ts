import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStudySummaryRequest } from "@/lib/ai/llm";
import { generateWithAI } from "@/lib/ai/llm.server";

const noteSummarySchema = z.object({
  bullets: z.array(z.string().trim().min(1)).length(3),
  fraseChave: z.string().trim().min(1),
});

export type NoteSummary = z.infer<typeof noteSummarySchema>;

const summaryInputSchema = z.object({
  content: z.string().trim().min(1, "A nota precisa ter conteúdo para gerar um resumo.").max(60_000),
  subject: z.string().trim().min(1).max(120),
});

function parseSummary(text: string): NoteSummary {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return noteSummarySchema.parse(JSON.parse(normalized));
  } catch {
    throw new Error("A IA retornou um formato inválido. Tente gerar o resumo novamente.");
  }
}

/** Generates a concise Portuguese summary for an authenticated user's note. */
export const generateNoteSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(summaryInputSchema)
  .handler(async ({ data }) => {
    const response = await generateWithAI(createStudySummaryRequest(data.content, data.subject));
    return parseSummary(response.text);
  });
