import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, CalendarClock, ListChecks, CalendarRange, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getOrCreateDailyPlan, updateDailyPlan } from "@/lib/api/plans.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Estudo+" }] }),
  component: Dashboard,
});

const motivacionais = [
  "Cada página estudada hoje é um passo a menos amanhã.",
  "Foco no progresso, não na perfeição.",
  "Pequenas constâncias fazem grandes resultados.",
  "Você não precisa ser rápido, só precisa continuar.",
  "Estude para entender, não só para passar.",
];

function Dashboard() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: dailyPlan } = useQuery({ queryKey: ["daily-plan", today], queryFn: () => getOrCreateDailyPlan({ data: { date: today } }), enabled: false });
  const planMutation = useMutation({ mutationFn: () => getOrCreateDailyPlan({ data: { date: today } }), onSuccess: (data) => qc.setQueryData(["daily-plan", today], data) });
  const planUpdate = useMutation({ mutationFn: updateDailyPlan, onSuccess: (data) => qc.setQueryData(["daily-plan", today], data) });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, subjects(name,color)")
        .eq("due_date", today)
        .neq("status", "concluida")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: rawEvents = [] } = useQuery({
    queryKey: ["events-upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", today)
        .order("event_date")
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: eventSubjects = [] } = useQuery({
    queryKey: ["event-subjects-upcoming", today],
    queryFn: async () => {
      const eventIds = rawEvents.map((e: any) => e.id);
      if (eventIds.length === 0) return [];
      const { data, error } = await supabase
        .from("event_subjects")
        .select("event_id, subject_id, subjects(name,color)")
        .in("event_id", eventIds)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: rawEvents.length > 0,
  });

  const events = useMemo(() => {
    const subMap = new Map<string, { id: string; name: string; color: string }[]>();
    for (const es of eventSubjects as any[]) {
      const list = subMap.get(es.event_id) ?? [];
      const sub = (es as any).subjects;
      if (sub) list.push({ id: es.subject_id, name: sub.name, color: sub.color });
      subMap.set(es.event_id, list);
    }
    return rawEvents.map((e: any) => ({
      ...e,
      subjectsList: subMap.get(e.id) ?? [],
    }));
  }, [rawEvents, eventSubjects]);

  const todayWeekday = new Date().getDay();
  const nowTime = new Date().toTimeString().slice(0, 5);
  const { data: todaySchedule = [] } = useQuery({
    queryKey: ["schedule-today", todayWeekday],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_slots")
        .select("*, subjects(name,color)")
        .eq("weekday", todayWeekday)
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const motiv = motivacionais[new Date().getDate() % motivacionais.length];
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedEvents);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedEvents(next);
  };

  return (
    <div className="stagger-children mx-auto max-w-5xl space-y-6">
      <div className="glass-card relative overflow-hidden p-6">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="tech-label">{format(new Date(), "EEEE · d 'de' MMMM", { locale: ptBR })}</p>
            <p className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {motiv}
            </p>
          </div>
        </div>
      </div>

      <section className="glass-card p-5">
        <header className="mb-4 flex items-center gap-2">
          <CalendarRange className="size-4 text-primary" />
          <h2 className="font-display font-semibold">Cronograma de hoje</h2>
          <Link to="/schedule" className="tech-label ml-auto transition-colors hover:text-primary">Ver semana →</Link>
        </header>

        {todaySchedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem horários para hoje. <Link to="/schedule" className="text-primary hover:underline">Configure seu cronograma</Link>.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {todaySchedule.map((s: any) => {
              const ongoing = s.start_time <= nowTime && (!s.end_time || nowTime <= s.end_time);
              const inner = (
                <div className={`flex items-center gap-3 p-2.5 rounded-lg transition ${ongoing ? "bg-primary/15 border border-primary/30" : "bg-muted/40 hover:bg-muted/70"}`}>
                  <span className="size-2 rounded-full shrink-0" style={{ background: s.subjects?.color || "var(--primary)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="size-3" />{s.start_time.slice(0, 5)}{s.end_time ? ` – ${s.end_time.slice(0, 5)}` : ""}{ongoing && <span className="text-primary ml-1">· agora</span>}</p>
                    <p className="text-sm font-medium truncate">{s.title}</p>
                  </div>
                </div>
              );
              return (
                <li key={s.id}>
                  {s.subject_id ? <Link to="/subjects/$id" params={{ id: s.subject_id }}>{inner}</Link> : inner}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="glass-card border-l-2 border-l-primary p-5">
        <header className="mb-3 flex items-center gap-2"><span className="text-primary">🎯</span><h2 className="font-display font-semibold">Plano de hoje</h2></header>
        {!dailyPlan ? <Button onClick={() => planMutation.mutate()} disabled={planMutation.isPending}>{planMutation.isPending ? "Gerando…" : "Gerar meu plano de hoje"}</Button> : <div className="space-y-3"><h3 className="font-medium">{dailyPlan.title}</h3><p className="text-sm text-muted-foreground">{dailyPlan.description}</p><ul className="space-y-2">{dailyPlan.items.map((entry: any, index: number) => <li key={`${entry.note_id}-${index}`} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={entry.completed} onChange={() => { const items = dailyPlan.items.map((item: any, i: number) => i === index ? { ...item, completed: !item.completed } : item); planUpdate.mutate({ data: { id: dailyPlan.id, items, completed: items.every((item: any) => item.completed) } }); }} /><span className={entry.completed ? "text-muted-foreground line-through" : ""}>{entry.title}<small className="block text-xs text-muted-foreground">{entry.reason}</small></span></li>)}</ul></div>}
      </section>


      <div className="grid md:grid-cols-2 gap-6">
        <section className="glass-card p-5">
          <header className="flex items-center gap-2 mb-4">
            <ListChecks className="size-4 text-primary" />
            <h2 className="font-display font-semibold">Tarefas para hoje</h2>
            <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
          </header>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa para hoje. Aproveite para adiantar conteúdo.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t: any) => (
                <li key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <span className="size-2 rounded-full" style={{ background: t.subjects?.color || "var(--primary)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.subjects?.name ?? "Sem matéria"} · {t.priority}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/tasks" className="text-xs text-primary mt-3 inline-block hover:underline">Ver todas →</Link>
        </section>

        <section className="glass-card p-5">
          <header className="flex items-center gap-2 mb-4">
            <CalendarClock className="size-4 text-primary" />
            <h2 className="font-display font-semibold">Próximos compromissos</h2>
          </header>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma data próxima cadastrada.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e: any) => {
                const d = parseISO(e.event_date);
                const days = differenceInCalendarDays(d, new Date());
                return (
                  <li key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                    <div className="text-center min-w-[44px]">
                      <p className="text-xs uppercase text-muted-foreground">{format(d, "MMM", { locale: ptBR })}</p>
                      <p className="text-lg font-semibold">{format(d, "dd")}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {e.subjectsList.length > 0 ? (
                          <>
                            {(expandedEvents.has(e.id) ? e.subjectsList : e.subjectsList.slice(0, 4)).map((s: any) => (
                              <Link
                                key={s.id}
                                to="/subjects/$id"
                                params={{ id: s.id }}
                                onClick={(ev) => ev.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-muted/60 border hover:bg-primary/15 hover:border-primary/40 hover:text-primary transition"
                              >
                                <span className="size-1.5 rounded-full" style={{ background: s.color || "var(--primary)" }} />
                                {s.name}
                              </Link>
                            ))}
                            {e.subjectsList.length > 4 && !expandedEvents.has(e.id) && (
                              <button
                                type="button"
                                onClick={(ev) => { ev.stopPropagation(); toggleExpanded(e.id); }}
                                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-muted/60 border hover:bg-primary/15 hover:border-primary/40 hover:text-primary transition"
                              >
                                +{e.subjectsList.length - 4}
                              </button>
                            )}
                            {e.subjectsList.length > 4 && expandedEvents.has(e.id) && (
                              <button
                                type="button"
                                onClick={(ev) => { ev.stopPropagation(); toggleExpanded(e.id); }}
                                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-muted/60 border hover:bg-primary/15 hover:border-primary/40 hover:text-primary transition"
                              >
                                Menos
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        <span className="text-xs text-muted-foreground">· {e.event_type}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-md shrink-0 ${days <= 1 ? "bg-destructive/20 text-destructive" : days <= 3 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"}`}>
                      {isToday(d) ? "Hoje" : days === 1 ? "Amanhã" : `${days}d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/calendar" className="text-xs text-primary mt-3 inline-block hover:underline">Ver calendário →</Link>
        </section>
      </div>
    </div>
  );
}
