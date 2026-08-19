import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TimerRing } from "@/components/focus/TimerRing";
import { useFocusSettings } from "@/components/focus/useFocusSettings";
import { usePomodoroTimer } from "@/components/focus/usePomodoroTimer";
import { generateNoteFlashcards, type NoteFlashcards } from "@/lib/api/ai.functions";
import { getCachedResponse, hashPrompt, setCachedResponse } from "@/lib/ai/llm";
import { updateDailyPlan } from "@/lib/api/plans.functions";
import { recordFlashcardAttempt } from "@/lib/study/proficiency";
import { recordLearningEvent } from "@/lib/study/events";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/study/session")({
  validateSearch: (search: Record<string, unknown>): { noteId?: string } => typeof search.noteId === "string" ? { noteId: search.noteId } : {},
  component: StudySession,
});

type Result = { correct: boolean; card: { pergunta: string; resposta: string; explicacao: string } };

function StudySession() {
  const { noteId } = Route.useSearch();
  const qc = useQueryClient();
  const { settings } = useFocusSettings();
  const [cards, setCards] = useState<NoteFlashcards | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [finished, setFinished] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const generatedRef = useRef(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ["study-note", noteId],
    enabled: !!noteId,
    queryFn: async () => {
      const { data, error } = await supabase.from("content_cards").select("id,title,text_content,subject_id,subjects(name)").eq("id", noteId!).eq("content_type", "text").single();
      if (error) throw error;
      return data as any;
    },
  });
  const { data: proficiency } = useQuery({
    queryKey: ["proficiency", noteId], enabled: !!noteId,
    queryFn: async () => (await supabase.from("topic_proficiency").select("score,streak").eq("note_id", noteId!).maybeSingle()).data as any,
  });
  const { data: dailyPlan } = useQuery({
    queryKey: ["daily-plan-session"],
    queryFn: async () => (await supabase.from("daily_plans").select("*").eq("plan_date", new Date().toISOString().slice(0, 10)).maybeSingle()).data as any,
  });

  const timer = usePomodoroTimer({ durationSeconds: settings.focus * 60, autoStart: !!note, onComplete: () => setTimeExpired(true) });

  useEffect(() => {
    if (note && !timer.running && timer.elapsed === 0 && !finished) timer.start();
  }, [note, finished, timer.elapsed, timer.running, timer.start]);

  const generate = useMutation({
    mutationFn: async () => {
      const content = note?.text_content?.trim();
      if (!content) throw new Error("Esta nota está vazia.");
      const hash = await hashPrompt(JSON.stringify({ feature: "study-session-flashcards-v1", content }));
      const cached = getCachedResponse(hash);
      if (cached) return JSON.parse(cached) as NoteFlashcards;
      const generated = await generateNoteFlashcards({ data: { content } });
      setCachedResponse(hash, JSON.stringify(generated));
      return generated;
    },
    onSuccess: setCards,
    onError: (error: Error) => toast.error(error.message || "Não foi possível gerar os flashcards."),
  });

  useEffect(() => {
    if (!note || generatedRef.current) return;
    generatedRef.current = true;
    generate.mutate();
  }, [note]);

  const current = cards?.flashcards[index];
  const attempt = useMutation({
    mutationFn: async (correct: boolean) => {
      if (!noteId || !current) throw new Error("Flashcard indisponível.");
      await recordFlashcardAttempt(noteId, correct);
      return correct;
    },
    onSuccess: (correct) => {
      if (!current) return;
      setResults((currentResults) => [...currentResults, { correct, card: current }]);
      qc.invalidateQueries({ queryKey: ["proficiency", noteId] });
      timer.start();
      if (cards && index >= cards.flashcards.length - 1) {
        setFinished(true);
        void recordLearningEvent({
          type: "STUDY_SESSION_COMPLETED",
          noteId,
          subjectId: note?.subject_id,
          metadata: { cardsCompleted: cards.flashcards.length, correct: results.filter((result) => result.correct).length + (correct ? 1 : 0) },
        }).catch((error) => {
          console.warn("Learning event tracking failed", { type: "STUDY_SESSION_COMPLETED", message: error instanceof Error ? error.message : "Unknown error" });
        });
      }
      else { setIndex((currentIndex) => currentIndex + 1); setRevealed(false); }
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível registrar a resposta."),
  });

  const markPlanItem = useMutation({
    mutationFn: async () => {
      if (!dailyPlan || !noteId) return;
      const items = dailyPlan.items.map((item: any) => item.note_id === noteId ? { ...item, completed: true } : item);
      return updateDailyPlan({ data: { id: dailyPlan.id, items, completed: items.every((item: any) => item.completed) } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["daily-plan-session"] }); toast.success("Item do plano concluído."); },
  });

  const accuracy = results.length ? Math.round((results.filter((result) => result.correct).length / results.length) * 100) : 0;
  const missed = useMemo(() => results.filter((result) => !result.correct), [results]);

  if (!noteId) return <div className="mx-auto max-w-xl glass-card p-6 text-center">Escolha uma nota para iniciar a sessão.</div>;
  if (isLoading || generate.isPending) return <div className="mx-auto max-w-xl glass-card p-10 text-center text-muted-foreground">Preparando sua sessão…</div>;
  if (!note || !cards || !current) return <div className="mx-auto max-w-xl glass-card p-6 text-center">Não foi possível abrir esta sessão.</div>;

  if (finished) return <div className="mx-auto max-w-xl space-y-5">
    <section className="glass-card border-l-2 border-l-primary p-6 text-center"><Sparkles className="mx-auto size-8 text-primary" /><h1 className="mt-3 font-display text-2xl font-semibold">Sessão finalizada!</h1><p className="mt-2 text-muted-foreground">Você acertou {results.filter((result) => result.correct).length}/{cards.flashcards.length} cards ({accuracy}%).</p><p className="mt-3 text-sm">Score: <strong>{proficiency?.score ?? 0}/100</strong> · 🔥 Streak: <strong>{proficiency?.streak ?? 0}</strong></p></section>
    {missed.length > 0 && <section className="glass-card p-5"><h2 className="font-medium">O que revisar depois</h2><ul className="mt-3 space-y-2 text-sm">{missed.map((result, itemIndex) => <li key={`${result.card.pergunta}-${itemIndex}`} className="text-muted-foreground">• {result.card.pergunta}</li>)}</ul></section>}
    <div className="flex flex-wrap gap-2"><Button asChild><a href="/dashboard">Voltar ao painel</a></Button><Button variant="secondary" onClick={() => { setFinished(false); setIndex(0); setResults([]); setRevealed(false); timer.reset(settings.focus * 60, true); }}>Próxima sessão</Button>{dailyPlan?.items?.some((item: any) => item.note_id === noteId && !item.completed) && <Button variant="outline" onClick={() => markPlanItem.mutate()} disabled={markPlanItem.isPending}>Marcar item do plano</Button>}</div>
  </div>;

  return <div className="mx-auto max-w-2xl space-y-5">
    <header className="glass-card flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="tech-label">Sessão: {note.subjects?.name ?? "Matéria"}</p><h1 className="font-display text-xl font-semibold">{note.title ?? "Sem título"}</h1><p className="mt-1 text-xs text-muted-foreground">📊 Score: {proficiency?.score ?? 0}/100 · 🔥 Streak: {proficiency?.streak ?? 0}</p></div><div className="scale-75 origin-right sm:scale-90"><TimerRing remaining={timer.remaining} total={timer.total} label="Foco" running={timer.running} /></div></header>
    <section className="glass-card p-5"><p className="tech-label">Flashcard {index + 1}/{cards.flashcards.length}</p><p className="mt-5 text-lg font-medium leading-relaxed">{current.pergunta}</p>{revealed ? <div className="mt-5 border-t border-border pt-4"><p className="font-medium">{current.resposta}</p><p className="mt-3 text-sm text-muted-foreground">{current.explicacao}</p><div className="mt-5 flex gap-2"><Button onClick={() => attempt.mutate(true)} disabled={attempt.isPending}><CheckCircle2 />Acertei</Button><Button variant="secondary" onClick={() => attempt.mutate(false)} disabled={attempt.isPending}><XCircle />Errei</Button></div></div> : <Button className="mt-6" variant="secondary" onClick={() => { setRevealed(true); timer.pause(); }}>Mostrar resposta</Button>}<div className="mt-6 flex justify-between"><Button variant="ghost" disabled={index === 0 || attempt.isPending} onClick={() => { setIndex((value) => value - 1); setRevealed(false); }}><ChevronLeft />Anterior</Button><Button variant="ghost" disabled={attempt.isPending} onClick={() => { if (index < cards.flashcards.length - 1) { setIndex((value) => value + 1); setRevealed(false); } }} >Próximo<ChevronRight /></Button></div></section>
    <AlertDialog open={timeExpired}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle><Clock3 className="mr-2 inline size-5 text-primary" />Tempo esgotado!</AlertDialogTitle><AlertDialogDescription>Você completou {results.length}/{cards.flashcards.length} flashcards.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => { setTimeExpired(false); timer.reset(settings.focus * 60, true); }}>Continuar sessão</AlertDialogCancel><AlertDialogAction onClick={() => { setTimeExpired(false); timer.reset(5 * 60, true); }}>Pausa de 5 min</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
