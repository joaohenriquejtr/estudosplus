import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createFlashcardsRequest, createStubFillRequest, createStudySummaryRequest } from "@/lib/ai/llm";
import { generateWithAI } from "@/lib/ai/llm.server";

const noteSummarySchema = z.object({
  bullets: z.array(z.string().trim().min(1)).length(3),
  fraseChave: z.string().trim().min(1),
});

export type NoteSummary = z.infer<typeof noteSummarySchema>;

const flashcardSchema = z.object({
  pergunta: z.string().trim().min(1),
  resposta: z.string().trim().min(1),
  explicacao: z.string().trim().min(1),
});

const noteFlashcardsSchema = z.object({
  flashcards: z.array(flashcardSchema).length(5),
});

export type NoteFlashcards = z.infer<typeof noteFlashcardsSchema>;

const summaryInputSchema = z.object({
  content: z.string().trim().min(1, "A nota precisa ter conteúdo para gerar um resumo.").max(60_000),
  subject: z.string().trim().min(1).max(120),
});

const stubFillInputSchema = z.object({
  topic: z.string().trim().min(1).max(240),
  subject: z.string().trim().min(1).max(120),
  references: z.array(z.object({
    title: z.string().trim().min(1).max(240),
    content: z.string().trim().min(1).max(20_000),
  })).min(1).max(3),
});

function parseJsonObject(text: string): unknown {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    // Some models prepend a short sentence before an otherwise valid JSON object.
    const start = normalized.indexOf("{");
    if (start < 0) throw new Error("No JSON object found");

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < normalized.length; index += 1) {
      const character = normalized[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) return JSON.parse(normalized.slice(start, index + 1)) as unknown;
      }
    }

    throw new Error("No complete JSON object found");
  }
}

function parseSummary(text: string): NoteSummary {
  try {
    return noteSummarySchema.parse(parseJsonObject(text));
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

/** Generates five review flashcards for an authenticated user's note. */
export const generateNoteFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(summaryInputSchema.pick({ content: true }))
  .handler(async ({ data }) => {
    const response = await generateWithAI(createFlashcardsRequest(data.content));
    try {
      return noteFlashcardsSchema.parse(parseJsonObject(response.text));
    } catch {
      throw new Error("A IA retornou flashcards em um formato inválido. Tente gerar novamente.");
    }
  });

/** Creates an unsaved draft for a wikilink stub from its related notes. */
export const fillNoteStub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(stubFillInputSchema)
  .handler(async ({ data }) => {
    const response = await generateWithAI(createStubFillRequest(data.topic, data.subject, data.references));
    const content = response.text.trim().replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```$/, "").trim();
    if (!content) throw new Error("A IA não retornou conteúdo para preencher a nota.");
    return { content };
  });
