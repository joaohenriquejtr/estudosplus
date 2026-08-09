import { useMemo } from "react";
import { format, startOfWeek, subDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Flame, Trophy, Clock, CalendarRange } from "lucide-react";
import { formatDuration } from "./useFocusSettings";
import { MODE_LABEL, type FocusMode } from "./useFocusSettings";

export type SessionRow = {
  id: string;
  subject_id: string | null;
  chapter_id: string | null;
  mode: string;
  note: string | null;
  started_at: string;
  duration_seconds: number;
  completed: boolean;
  subjects?: { name: string; color: string | null } | null;
};

const dayKey = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");

export function FocusStats({ sessions }: { sessions: SessionRow[] }) {
  const focusSessions = useMemo(() => sessions.filter((s) => s.mode === "focus"), [sessions]);

  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of focusSessions) {
      if (!s.completed) continue;
      const k = dayKey(s.started_at);
      map.set(k, (map.get(k) ?? 0) + s.duration_seconds);
    }
    return map;
  }, [focusSessions]);

  const { streak, best } = useMemo(() => {
    const days = [...perDay.keys()].sort();
    if (!days.length) return { streak: 0, best: 0 };
    const set = new Set(days);
    let bestRun = 0;
    for (const d of days) {
      const prev = dayKey(subDays(new Date(`${d}T12:00:00`), 1));
      if (set.has(prev)) continue;
      let run = 0;
      let cursor = new Date(`${d}T12:00:00`);
      while (set.has(dayKey(cursor))) {
        run += 1;
        cursor = new Date(cursor.getTime() + 86400000);
      }
      bestRun = Math.max(bestRun, run);
    }
    let current = 0;
    let cur = new Date();
    if (!set.has(dayKey(cur))) cur = subDays(cur, 1);
    while (set.has(dayKey(cur))) {
      current += 1;
      cur = subDays(cur, 1);
    }
    return { streak: current, best: bestRun };
  }, [perDay]);

  const today = perDay.get(dayKey(new Date())) ?? 0;

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekSessions = useMemo(
    () => focusSessions.filter((s) => s.completed && new Date(s.started_at) >= weekStart),
    [focusSessions, weekStart],
  );
  const weekTotal = weekSessions.reduce((acc, s) => acc + s.duration_seconds, 0);

  const perSubject = useMemo(() => {
    const map = new Map<string, { name: string; color: string; seconds: number }>();
    for (const s of weekSessions) {
      const name = s.subjects?.name ?? "Sem matéria";
      const key = s.subject_id ?? "none";
      const entry = map.get(key) ?? { name, color: s.subjects?.color ?? "#8b5cf6", seconds: 0 };
      entry.seconds += s.duration_seconds;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.seconds - a.seconds);
  }, [weekSessions]);

  const heatmap = useMemo(() => {
    const days: { key: string; date: Date; seconds: number }[] = [];
    const start = startOfWeek(subDays(new Date(), 90), { weekStartsOn: 1 });
    for (let d = start; d <= new Date(); d = new Date(d.getTime() + 86400000)) {
      const k = dayKey(d);
      days.push({ key: k, date: new Date(d), seconds: perDay.get(k) ?? 0 });
    }
    const weeks: (typeof days)[] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, [perDay]);

  const maxDay = Math.max(1, ...[...perDay.values()]);
  const maxSubject = Math.max(1, ...perSubject.map((s) => s.seconds));

  const cards = [
    { icon: Flame, label: "streak atual", value: `${streak} ${streak === 1 ? "dia" : "dias"}` },
    { icon: Trophy, label: "melhor streak", value: `${best} ${best === 1 ? "dia" : "dias"}` },
    { icon: Clock, label: "focado hoje", value: formatDuration(today) },
    { icon: CalendarRange, label: "focado na semana", value: formatDuration(weekTotal) },
  ];

  return (
    <div className="stagger-children space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-2">
              <c.icon className="size-4 text-primary" />
              <span className="tech-label text-[0.6rem]">{c.label}</span>
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-lg p-4">
        <p className="tech-label mb-3 text-[0.6rem]">// constância — últimos 3 meses</p>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {heatmap.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => {
                const intensity = day.seconds === 0 ? 0 : Math.min(1, day.seconds / maxDay);
                return (
                  <div
                    key={day.key}
                    title={`${format(day.date, "dd 'de' MMM", { locale: ptBR })} — ${day.seconds ? formatDuration(day.seconds) : "sem sessões"}`}
                    className="size-3 shrink-0 rounded-[3px] border border-border/40 transition-transform duration-200 hover:scale-125"
                    style={{
                      backgroundColor: intensity ? `color-mix(in oklab, var(--primary) ${20 + intensity * 80}%, transparent)` : "transparent",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <p className="tech-label mb-3 text-[0.6rem]">// horas por matéria — esta semana</p>
        {perSubject.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão concluída nesta semana.</p>
        ) : (
          <ul className="space-y-3">
            {perSubject.map((s) => (
              <li key={s.name}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{s.name}</span>
                  <span className="tech-label text-[0.6rem]">{formatDuration(s.seconds)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${(s.seconds / maxSubject) * 100}%`, backgroundColor: s.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card rounded-lg p-4">
        <p className="tech-label mb-3 text-[0.6rem]">// últimas sessões</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Suas sessões aparecerão aqui.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {sessions.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.subjects?.color ?? "var(--muted-foreground)" }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {s.subjects?.name ?? MODE_LABEL[s.mode as FocusMode] ?? "Sessão"}
                  {s.note ? <span className="text-muted-foreground"> — {s.note}</span> : null}
                </span>
                <span className="tech-label shrink-0 text-[0.6rem]">{formatDuration(s.duration_seconds)}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {isSameDay(new Date(s.started_at), new Date())
                    ? format(new Date(s.started_at), "HH:mm")
                    : format(new Date(s.started_at), "dd/MM HH:mm")}
                </span>
                <span
                  className={`tech-label shrink-0 text-[0.6rem] ${s.completed ? "text-primary" : "text-muted-foreground/70"}`}
                >
                  {s.completed ? "concluída" : "parcial"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
