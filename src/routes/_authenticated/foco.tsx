import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Timer, Play, Pause, RotateCcw, Check, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { TimerRing } from "@/components/focus/TimerRing";
import { FocusStats, type SessionRow } from "@/components/focus/FocusStats";
import {
  MODE_LABEL,
  useFocusSettings,
  playChime,
  notify,
  type FocusMode,
} from "@/components/focus/useFocusSettings";
import { usePomodoroTimer } from "@/components/focus/usePomodoroTimer";
import { recordLearningEvent } from "@/lib/study/events";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TITLE = "Modo Foco — Estudo+";
const DESCRIPTION =
  "Pomodoro com objetivo por matéria, registro de sessões, streak de constância e horas focadas por semana.";

export const Route = createFileRoute("/_authenticated/foco")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: FocusPage,
});

const MODES: FocusMode[] = ["focus", "short_break", "long_break"];

function FocusPage() {
  const qc = useQueryClient();
  const { settings, update } = useFocusSettings();

  const [mode, setMode] = useState<FocusMode>("focus");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [focusCount, setFocusCount] = useState(0);
  const [subjectId, setSubjectId] = useState<string>("none");
  const [chapterId, setChapterId] = useState<string>("none");
  const [note, setNote] = useState("");

  const durationMinutes = settings[mode];
  const total = durationMinutes * 60;
  const onTimerCompleteRef = useRef<() => void>(() => undefined);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", subjectId],
    enabled: subjectId !== "none",
    queryFn: async () =>
      (await supabase.from("chapters").select("id,title").eq("subject_id", subjectId).order("position")).data ?? [],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("id,subject_id,chapter_id,mode,note,started_at,duration_seconds,completed,subjects(name,color)")
        .order("started_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SessionRow[];
    },
  });


  const startSession = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({
          user_id: auth.user!.id,
          subject_id: subjectId === "none" ? null : subjectId,
          chapter_id: chapterId === "none" ? null : chapterId,
          mode,
          note: note.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onError: () => toast.error("Não foi possível iniciar a sessão."),
  });

  const finishSession = useMutation({
    mutationFn: async (vars: { id: string; duration_seconds: number; completed: boolean }) => {
      const { error } = await supabase
        .from("study_sessions")
        .update({
          duration_seconds: vars.duration_seconds,
          completed: vars.completed,
          ended_at: new Date().toISOString(),
          note: note.trim() || null,
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  const timer = usePomodoroTimer({
    durationSeconds: total,
    onComplete: () => onTimerCompleteRef.current(),
  });
  const { running, remaining } = timer;

  const reset = useCallback(() => {
    timer.reset(total);
    setSessionId(null);
  }, [timer.reset, total]);

  const conclude = useCallback(
    async (completed: boolean) => {
      const spent = Math.round(timer.elapsed);
      if (sessionId) await finishSession.mutateAsync({ id: sessionId, duration_seconds: spent, completed });
      if (completed && mode === "focus") {
        void recordLearningEvent({
          type: "STUDY_SESSION_COMPLETED",
          subjectId: subjectId === "none" ? null : subjectId,
          metadata: { durationSeconds: spent, source: "focus" },
        }).catch((error) => {
          console.warn("Learning event tracking failed", { type: "STUDY_SESSION_COMPLETED", message: error instanceof Error ? error.message : "Unknown error" });
        });
      }
      reset();
      if (mode === "focus" && completed) {
        const nextCount = focusCount + 1;
        setFocusCount(nextCount);
        const nextMode: FocusMode = nextCount % 4 === 0 ? "long_break" : "short_break";
        setMode(nextMode);
        toast.success(`Foco concluído! Sugestão: ${MODE_LABEL[nextMode].toLowerCase()}.`);
      } else if (completed) {
        setMode("focus");
        toast.success("Pausa concluída. Bora focar!");
      } else {
        toast.info("Sessão encerrada e registrada.");
      }
    },
    [timer.elapsed, sessionId, finishSession, reset, mode, focusCount, subjectId],
  );

  onTimerCompleteRef.current = () => {
    if (settings.sound) playChime();
    notify(`${MODE_LABEL[mode]} concluído`, note.trim() || "Hora de trocar de ciclo.");
    void conclude(true);
  };

  const toggle = async () => {
    if (running) {
      timer.pause();
      return;
    }
    if (!sessionId) {
      const id = await startSession.mutateAsync().catch(() => null);
      if (!id) return;
      setSessionId(id);
      notify(`${MODE_LABEL[mode]} iniciado`, note.trim() || "Sessão em andamento.");
    }
    timer.start();
  };

  const discard = async () => {
    if (sessionId) {
      const spent = Math.round(timer.elapsed);
      await finishSession.mutateAsync({ id: sessionId, duration_seconds: spent, completed: false });
    }
    reset();
  };

  // Avisa antes de sair com sessão rodando.
  const blocker = useBlocker({ shouldBlockFn: () => running, withResolver: true });
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  const subjectName = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.name ?? null,
    [subjects, subjectId],
  );
  const chapterName = useMemo(
    () => chapters.find((c) => c.id === chapterId)?.title ?? null,
    [chapters, chapterId],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={Timer}
        title="Modo Foco"
        description="Pomodoro com objetivo, registro de sessões e constância."
        action={
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="size-4" />
                <span className="hidden sm:inline">Ajustes</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <p className="tech-label text-[0.6rem]">// durações (min)</p>
              {MODES.map((m) => (
                <div key={m} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`dur-${m}`} className="text-sm">{MODE_LABEL[m]}</Label>
                  <Input
                    id={`dur-${m}`}
                    type="number"
                    min={1}
                    max={180}
                    className="w-20"
                    value={settings[m]}
                    onChange={(e) => update({ [m]: Math.max(1, Number(e.target.value) || 1) } as never)}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <Label htmlFor="sound" className="text-sm">Som ao terminar</Label>
                <Switch id="sound" checked={settings.sound} onCheckedChange={(v) => update({ sound: v })} />
              </div>
            </PopoverContent>
          </Popover>
        }
      />

      <section className="glass-card animate-rise rounded-lg p-4 sm:p-6">
        <p className="tech-label mb-3 text-[0.6rem]">// objetivo da sessão</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Matéria</Label>
            <Select
              value={subjectId}
              onValueChange={(v) => {
                setSubjectId(v);
                setChapterId("none");
              }}
              disabled={running}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem matéria</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conteúdo (opcional)</Label>
            <Select value={chapterId} onValueChange={setChapterId} disabled={running || subjectId === "none"}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem conteúdo</SelectItem>
                {chapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note" className="text-xs">No que vou focar agora</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: resolver lista 3 de cinemática"
            />
          </div>
        </div>

        {(subjectName || chapterName || note.trim()) && (
          <p className="mt-4 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <span className="tech-label mr-2 text-[0.6rem]">objetivo</span>
            {[subjectName, chapterName, note.trim() || null].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-6">
          <TimerRing remaining={remaining} total={timer.total} label={MODE_LABEL[mode]} running={running} />
        </div>

        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (running || sessionId) {
              toast.info("Encerre ou reinicie a sessão atual antes de trocar de modo.");
              return;
            }
            setMode(v as FocusMode);
          }}
          className="mt-6"
        >
          <TabsList className="w-full">
            {MODES.map((m) => (
              <TabsTrigger key={m} value={m} className="flex-1 text-xs sm:text-sm">
                {MODE_LABEL[m]} ({settings[m]}min)
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button onClick={() => void toggle()} className="gap-2" disabled={startSession.isPending}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "Pausar" : timer.elapsed > 0 ? "Continuar" : "Iniciar"}
          </Button>
          <Button variant="outline" onClick={() => void discard()} className="gap-2" disabled={!sessionId && !running}>
            <RotateCcw className="size-4" />
            Reiniciar
          </Button>
          <Button variant="secondary" onClick={() => void conclude(true)} className="gap-2" disabled={!sessionId}>
            <Check className="size-4" />
            Concluir
          </Button>
        </div>
      </section>

      <div className="mt-8">
        <FocusStats sessions={sessions} />
      </div>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sessão em andamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem uma sessão rodando. Se sair agora, ela será registrada como parcial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Ficar na página</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await discard();
                blocker.proceed?.();
              }}
            >
              Sair e registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
