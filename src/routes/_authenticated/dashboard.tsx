import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, CalendarClock, ListChecks } from "lucide-react";
import { useMemo } from "react";

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
  const today = new Date().toISOString().slice(0, 10);

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

  const motiv = motivacionais[new Date().getDate() % motivacionais.length];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="glass-card p-6 flex gap-4 items-start">
        <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Sparkles className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          <p className="text-lg font-medium mt-1">{motiv}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="glass-card p-5">
          <header className="flex items-center gap-2 mb-4">
            <ListChecks className="size-4 text-primary" />
            <h2 className="font-semibold">Tarefas para hoje</h2>
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
            <h2 className="font-semibold">Próximas provas</h2>
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
                          e.subjectsList.map((s: any) => (
                            <span key={s.id} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-muted/60 border">
                              <span className="size-1.5 rounded-full" style={{ background: s.color || "var(--primary)" }} />
                              {s.name}
                            </span>
                          ))
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
