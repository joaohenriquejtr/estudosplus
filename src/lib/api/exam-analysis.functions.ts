import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateEmbedding } from "@/lib/ai/embeddings.server";
import { generateWithAI } from "@/lib/ai/llm.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const topicDraft = z.object({ subjectId: z.string().uuid(), name: z.string().trim().min(1).max(160) });
const eventInput = z.object({ eventId: z.string().uuid() });

export type TopicStatus = "HIGH" | "MEDIUM" | "LOW" | "NOT_STUDIED";
export type ExamTopicAnalysis = {
  id: string;
  name: string;
  subjectId: string;
  status: TopicStatus;
  score: number;
  evidence: string[];
  relatedNotes: Array<{ id: string; title: string; similarity: number }>;
};

function parseJson(text: string): unknown {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(normalized);
}

async function ownedExam(db: any, userId: string, eventId: string) {
  const result = await db.from("events").select("id,title,event_date,event_type,notes,subject_id").eq("id", eventId).eq("user_id", userId).single();
  if (result.error || !result.data) throw new Error("Prova não encontrada.");
  if (result.data.event_type !== "prova") throw new Error("A análise de gaps está disponível apenas para provas.");
  return result.data as { id: string; title: string; event_date: string; event_type: string; notes: string | null; subject_id: string | null };
}

async function getExamSubjects(db: any, eventId: string) {
  const result = await db.from("event_subjects").select("subject_id, subjects(name)").eq("event_id", eventId);
  if (result.error) throw result.error;
  return (result.data ?? []).map((row: any) => ({ id: row.subject_id as string, name: row.subjects?.name as string || "Matéria" }));
}

export const getExamTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventInput)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ownedExam(db, context.userId, data.eventId);
    const result = await db.from("exam_topics").select("id,topic_name,subject_id").eq("exam_id", data.eventId).order("topic_name");
    if (result.error) throw result.error;
    return (result.data ?? []).map((topic: any) => ({ id: topic.id as string, subjectId: topic.subject_id as string, name: topic.topic_name as string }));
  });

export const extractExamTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ title: z.string().trim().min(1).max(240), content: z.string().trim().min(1).max(12_000), subjects: z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) })).min(1).max(12) }))
  .handler(async ({ data }) => {
    const generated = await Promise.all(data.subjects.map(async (subject) => {
      const response = await generateWithAI({
        temperature: 0.3,
        maxTokens: 800,
        jsonMode: true,
        messages: [
          { role: "system", content: "Você extrai tópicos de prova. Use português do Brasil e responda somente JSON válido." },
          { role: "user", content: `Título da prova: ${data.title}\nConteúdo cobrado: ${data.content}\nMatéria: ${subject.name}\n\nExtraia entre 3 e 10 tópicos específicos cobrados nesta matéria. Evite tópicos genéricos. Responda: {"topics":["... "]}` },
        ],
      });
      const parsed = z.object({ topics: z.array(z.string().trim().min(1).max(160)).min(1).max(10) }).parse(parseJson(response.text));
      return parsed.topics.map((name) => ({ subjectId: subject.id, name }));
    }));
    return generated.flat();
  });

export const replaceExamTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ eventId: z.string().uuid(), topics: z.array(topicDraft).max(80) }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ownedExam(db, context.userId, data.eventId);
    const subjects = await getExamSubjects(db, data.eventId);
    const allowedSubjectIds = new Set(subjects.map((subject) => subject.id));
    if (data.topics.some((topic) => !allowedSubjectIds.has(topic.subjectId))) throw new Error("Um tópico precisa pertencer a uma matéria desta prova.");

    const uniqueTopics = Array.from(new Map(data.topics.map((topic) => [`${topic.subjectId}:${topic.name.toLocaleLowerCase("pt-BR")}`, topic])).values());
    const deleted = await db.from("exam_topics").delete().eq("exam_id", data.eventId);
    if (deleted.error) throw deleted.error;
    if (uniqueTopics.length === 0) return [];
    const inserted = await db.from("exam_topics").insert(uniqueTopics.map((topic) => ({ exam_id: data.eventId, subject_id: topic.subjectId, topic_name: topic.name }))).select("id,topic_name,subject_id");
    if (inserted.error) throw inserted.error;
    return inserted.data;
  });

async function analyzeExamForUser(db: any, userId: string, eventId: string) {
  const exam = await ownedExam(db, userId, eventId);
  const topicsResult = await db.from("exam_topics").select("id,topic_name,subject_id").eq("exam_id", eventId).order("topic_name");
  if (topicsResult.error) throw topicsResult.error;
  const topics = topicsResult.data ?? [];
  if (topics.length === 0) return { exam, topics: [] as ExamTopicAnalysis[], overallCoverage: 0, suggestedPlan: "" };

  const analysis = await Promise.all(topics.map(async (topic: any): Promise<ExamTopicAnalysis> => {
    const embedding = await generateEmbedding(topic.topic_name);
    const related = await db.rpc("match_content_cards" as never, {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: 0.65,
      match_count: 10,
      p_subject_id: topic.subject_id,
      p_user_id: userId,
    } as never);
    if (related.error) throw related.error;
    const relatedNotes = (related.data ?? []) as Array<{ id: string; title: string | null; similarity: number }>;
    if (relatedNotes.length === 0) return { id: topic.id, name: topic.topic_name, subjectId: topic.subject_id, status: "NOT_STUDIED", score: 0, evidence: ["Nenhuma nota relacionada encontrada"], relatedNotes: [] };

    const noteIds = relatedNotes.map((note) => note.id);
    const proficiency = await db.from("topic_proficiency").select("note_id,score,total_attempts,correct_attempts").eq("user_id", userId).in("note_id", noteIds);
    if (proficiency.error) throw proficiency.error;
    const records = proficiency.data ?? [];
    const score = records.length ? Math.round(records.reduce((total: number, entry: any) => total + entry.score, 0) / records.length) : 0;
    const attempts = records.reduce((total: number, entry: any) => total + entry.total_attempts, 0);
    const correct = records.reduce((total: number, entry: any) => total + entry.correct_attempts, 0);
    const evidence = attempts > 0 ? [`${correct}/${attempts} flashcards acertados`] : ["Notas relacionadas, mas ainda sem prática com flashcards"];
    const low = records.filter((entry: any) => entry.score < 40).length;
    const high = records.filter((entry: any) => entry.score >= 70).length;
    if (low) evidence.push(`${low} nota(s) com domínio baixo`);
    if (high) evidence.push(`${high} nota(s) com domínio alto`);
    const status: TopicStatus = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : score > 0 ? "LOW" : "NOT_STUDIED";
    return { id: topic.id, name: topic.topic_name, subjectId: topic.subject_id, status, score, evidence, relatedNotes: relatedNotes.map((note) => ({ id: note.id, title: note.title || "Sem título", similarity: Number(note.similarity) })) };
  }));

  const overallCoverage = Math.round(analysis.reduce((total, topic) => total + (topic.status === "HIGH" ? 100 : topic.status === "MEDIUM" ? 60 : topic.status === "LOW" ? 20 : 0), 0) / analysis.length);
  const daysUntil = Math.max(0, Math.ceil((new Date(`${exam.event_date}T23:59:59`).getTime() - Date.now()) / 86_400_000));
  let suggestedPlan = "";
  try {
    const response = await generateWithAI({ temperature: 0.4, maxTokens: 700, messages: [
      { role: "system", content: "Você é um tutor encorajador e direto. Use português do Brasil." },
      { role: "user", content: `Uma prova acontece em ${daysUntil} dia(s). Cobertura atual: ${overallCoverage}%.\nTópicos: ${analysis.map((topic) => `${topic.name}: ${topic.status} (${topic.score}/100)`).join("; ")}\n\nEscreva um plano conciso de no máximo 3 parágrafos. Priorize NOT_STUDIED e LOW e dê uma sugestão prática.` },
    ] });
    suggestedPlan = response.text.trim();
  } catch (error) {
    console.error("Exam suggested plan failed", { message: error instanceof Error ? error.message : "Erro desconhecido" });
  }
  return { exam, topics: analysis, overallCoverage, suggestedPlan, daysUntil };
}

export const analyzeExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventInput)
  .handler(async ({ data, context }) => analyzeExamForUser(context.supabase as any, context.userId, data.eventId));

export const createExamTopicStub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ eventId: z.string().uuid(), topicId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ownedExam(db, context.userId, data.eventId);
    const topic = await db.from("exam_topics").select("topic_name,subject_id").eq("id", data.topicId).eq("exam_id", data.eventId).single();
    if (topic.error || !topic.data) throw new Error("Tópico não encontrado.");
    const existing = await db.from("content_cards").select("id").eq("user_id", context.userId).eq("subject_id", topic.data.subject_id).eq("content_type", "text").eq("title", topic.data.topic_name).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { noteId: existing.data.id, subjectId: topic.data.subject_id, created: false };
    const inserted = await db.from("content_cards").insert({ user_id: context.userId, subject_id: topic.data.subject_id, title: topic.data.topic_name, content_type: "text", text_content: "", category: "anotacao" }).select("id").single();
    if (inserted.error) throw inserted.error;
    return { noteId: inserted.data.id, subjectId: topic.data.subject_id, created: true };
  });

export const addExamGapsToDailyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventInput)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const result = await analyzeExamForUser(db, context.userId, data.eventId);
    const today = new Date().toISOString().slice(0, 10);
    const existing = await db.from("daily_plans").select("*").eq("user_id", context.userId).eq("plan_date", today).maybeSingle();
    if (existing.error) throw existing.error;
    const currentItems = existing.data?.items ?? [];
    const additions: any[] = [];
    for (const topic of result.topics.filter((entry) => entry.status === "LOW" || entry.status === "NOT_STUDIED")) {
      let noteId = topic.relatedNotes[0]?.id;
      if (!noteId) {
        const found = await db.from("content_cards").select("id").eq("user_id", context.userId).eq("subject_id", topic.subjectId).eq("content_type", "text").eq("title", topic.name).maybeSingle();
        if (found.error) throw found.error;
        if (found.data) noteId = found.data.id;
        else {
          const created = await db.from("content_cards").insert({ user_id: context.userId, subject_id: topic.subjectId, title: topic.name, content_type: "text", text_content: "", category: "anotacao" }).select("id").single();
          if (created.error) throw created.error;
          noteId = created.data.id;
        }
      }
      if (!currentItems.some((item: any) => item.note_id === noteId) && !additions.some((item) => item.note_id === noteId)) additions.push({ type: topic.status === "NOT_STUDIED" ? "stub" : "review", note_id: noteId, title: topic.name, reason: `Tópico cobrado em ${result.exam.title} em ${result.daysUntil} dia(s).`, completed: false });
    }
    const items = [...currentItems, ...additions].slice(0, 5);
    if (existing.data) {
      const updated = await db.from("daily_plans").update({ items, completed: items.length > 0 && items.every((item: any) => item.completed) }).eq("id", existing.data.id).select("*").single();
      if (updated.error) throw updated.error;
      return { added: additions.length, plan: updated.data };
    }
    const created = await db.from("daily_plans").insert({ user_id: context.userId, plan_date: today, title: "Plano de hoje: foco na prova", description: `Prioridades para ${result.exam.title}.`, items }).select("*").single();
    if (created.error) throw created.error;
    return { added: additions.length, plan: created.data };
  });
