import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithAI } from "@/lib/ai/llm.server";
import type { LLMMessage } from "@/lib/ai/llm";

const item = z.object({ type: z.enum(["stub", "review", "flashcard"]), note_id: z.string().uuid(), title: z.string(), reason: z.string(), completed: z.boolean().default(false) });
const plan = z.object({ title: z.string(), description: z.string(), items: z.array(item).max(5) });

export const getOrCreateDailyPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).handler(async ({ data, context }) => {
  const db = context.supabase as any;
  const existing = await db.from("daily_plans").select("*").eq("user_id", context.userId).eq("plan_date", data.date).maybeSingle();
  if (existing.data) return existing.data;
  const end = new Date(`${data.date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 14);
  const events = await db.from("events").select("id,title,event_date,event_type").eq("user_id", context.userId).gte("event_date", data.date).lte("event_date", end.toISOString().slice(0, 10)).eq("event_type", "prova");
  const notes = await db.from("content_cards").select("id,title,text_content,subject_id").eq("user_id", context.userId).eq("content_type", "text").limit(100);
  const weak = await db.from("topic_proficiency").select("note_id,score").eq("user_id", context.userId).lt("score", 60).limit(20);
  const prompt: LLMMessage[] = [
    { role: "system", content: "Você é um tutor pessoal. Use português do Brasil e seja direto." },
    { role: "user", content: `Monte um plano de estudos para HOJE. Máximo 5 itens, priorizando stubs de provas, tópicos fracos e revisões.\nProvas: ${JSON.stringify(events.data ?? [])}\nNotas/stubs: ${JSON.stringify((notes.data ?? []).filter((n: any) => !n.text_content?.trim()))}\nTópicos fracos: ${JSON.stringify(weak.data ?? [])}\nResponda somente JSON: {"title":"...","description":"...","items":[{"type":"stub|review|flashcard","note_id":"uuid","title":"...","reason":"..."}]}` },
  ];
  const generated = await generateWithAI({ messages: prompt, temperature: 0.3, maxTokens: 2048, jsonMode: true });
  const parsed = plan.parse(JSON.parse(generated.text.replace(/^```json\s*/i, "").replace(/\s*```$/, "")));
  const saved = await db.from("daily_plans").insert({ user_id: context.userId, plan_date: data.date, ...parsed }).select("*").single();
  if (saved.error) throw saved.error;
  return saved.data;
});

export const updateDailyPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid(), items: z.array(item), completed: z.boolean() })).handler(async ({ data, context }) => {
  const { data: result, error } = await (context.supabase as any).from("daily_plans").update({ items: data.items, completed: data.completed }).eq("id", data.id).eq("user_id", context.userId).select("*").single();
  if (error) throw error;
  return result;
});
