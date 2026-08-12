import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithAI } from "@/lib/ai/llm.server";
import type { LLMMessage } from "@/lib/ai/llm";

const item = z.object({ type: z.enum(["stub", "review", "flashcard"]), note_id: z.string().uuid(), title: z.string(), reason: z.string(), completed: z.boolean().default(false) });
const plan = z.object({ title: z.string(), description: z.string(), items: z.array(item).max(5) });
const dateInput = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

function parsePlan(text: string) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return plan.parse(JSON.parse(normalized));
}

/** Returns today's saved plan without generating a new one. */
export const getDailyPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(dateInput).handler(async ({ data, context }) => {
  const result = await (context.supabase as any).from("daily_plans").select("*").eq("user_id", context.userId).eq("plan_date", data.date).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
});

export const getOrCreateDailyPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(dateInput).handler(async ({ data, context }) => {
  const db = context.supabase as any;
  const existing = await db.from("daily_plans").select("*").eq("user_id", context.userId).eq("plan_date", data.date).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const end = new Date(`${data.date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 14);
  const events = await db.from("events").select("id,title,event_date,event_type").eq("user_id", context.userId).gte("event_date", data.date).lte("event_date", end.toISOString().slice(0, 10)).eq("event_type", "prova");
  const notes = await db.from("content_cards").select("id,title,text_content,subject_id").eq("user_id", context.userId).eq("content_type", "text").limit(100);
  const weak = await db.from("topic_proficiency").select("note_id,score").eq("user_id", context.userId).lt("score", 60).limit(20);
  if (events.error) throw events.error;
  if (notes.error) throw notes.error;

  const noteList = notes.data ?? [];
  const notesById = new Map(noteList.map((note: any) => [note.id, note]));
  const stubs = noteList.filter((note: any) => !note.text_content?.trim());
  const weakNotes = (weak.data ?? []).flatMap((entry: any) => {
    const note = notesById.get(entry.note_id);
    return note ? [{ ...note, score: entry.score }] : [];
  });
  const candidates = [...stubs, ...weakNotes, ...noteList.filter((note: any) => note.text_content?.trim())]
    .filter((note: any, index: number, list: any[]) => list.findIndex((candidate) => candidate.id === note.id) === index)
    .slice(0, 20);

  if (candidates.length === 0) {
    const saved = await db.from("daily_plans").insert({
      user_id: context.userId,
      plan_date: data.date,
      title: "Plano de hoje: comece sua base",
      description: "Crie ou complete uma nota para a IA montar um plano personalizado amanhã.",
      items: [],
    }).select("*").single();
    if (saved.error) throw saved.error;
    return saved.data;
  }

  const prompt: LLMMessage[] = [
    { role: "system", content: "Você é um tutor pessoal. Use português do Brasil e seja direto." },
    { role: "user", content: `Monte um plano de estudos para HOJE. Máximo 5 itens, priorizando stubs de provas, tópicos fracos e revisões.\nProvas: ${JSON.stringify(events.data ?? [])}\nItens permitidos (use SOMENTE estes note_id): ${JSON.stringify(candidates.map((note: any) => ({ note_id: note.id, title: note.title, vazio: !note.text_content?.trim(), score: note.score ?? null })))}\nResponda somente JSON: {"title":"...","description":"...","items":[{"type":"stub|review|flashcard","note_id":"uuid","title":"...","reason":"..."}]}` },
  ];
  const generated = await generateWithAI({ messages: prompt, temperature: 0.3, maxTokens: 2048, jsonMode: true });
  const parsed = parsePlan(generated.text);
  const allowedIds = new Set(candidates.map((note: any) => note.id));
  const validItems = parsed.items.filter((entry) => allowedIds.has(entry.note_id)).map((entry) => ({ ...entry, completed: false }));
  const fallbackNote = candidates[0] as any;
  const items = validItems.length > 0 ? validItems : [{
    type: (!fallbackNote.text_content?.trim() ? "stub" : "review") as "stub" | "review",
    note_id: fallbackNote.id,
    title: fallbackNote.title,
    reason: "Retome este conteúdo para fortalecer sua base de estudos.",
    completed: false,
  }];
  const saved = await db.from("daily_plans").insert({ user_id: context.userId, plan_date: data.date, ...parsed, items }).select("*").single();
  if (saved.error) throw saved.error;
  return saved.data;
});

export const updateDailyPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid(), items: z.array(item), completed: z.boolean() })).handler(async ({ data, context }) => {
  const { data: result, error } = await (context.supabase as any).from("daily_plans").update({ items: data.items, completed: data.completed }).eq("id", data.id).eq("user_id", context.userId).select("*").single();
  if (error) throw error;
  return result;
});
