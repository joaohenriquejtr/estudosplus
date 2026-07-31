import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, Plus, Trash2, Clock, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useConfirm } from "@/components/useConfirm";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Cronograma — Estudo+" }] }),
  component: SchedulePage,
});

const WEEKDAYS = [
  { idx: 1, name: "Segunda" },
  { idx: 2, name: "Terça" },
  { idx: 3, name: "Quarta" },
  { idx: 4, name: "Quinta" },
  { idx: 5, name: "Sexta" },
  { idx: 6, name: "Sábado" },
  { idx: 0, name: "Domingo" },
];

type SlotForm = { weekday: string; start_time: string; end_time: string; subject_id: string; title: string };
const EMPTY: SlotForm = { weekday: "1", start_time: "08:00", end_time: "", subject_id: "", title: "" };

function SchedulePage() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SlotForm>(EMPTY);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: slots = [], isLoading, isError } = useQuery({
    queryKey: ["schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("schedule_slots").select("*, subjects(name,color)").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const s of slots as any[]) {
      const arr = map.get(s.weekday) ?? [];
      arr.push(s);
      map.set(s.weekday, arr);
    }
    return map;
  }, [slots]);

  const todayIdx = new Date().getDay();
  const nowTime = new Date().toTimeString().slice(0, 5);

  const openCreate = (weekday?: number) => {
    setEditingId(null);
    setForm({ ...EMPTY, weekday: String(weekday ?? new Date().getDay()) });
    setOpen(true);
  };
  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      weekday: String(s.weekday),
      start_time: s.start_time?.slice(0, 5) ?? "08:00",
      end_time: s.end_time?.slice(0, 5) ?? "",
      subject_id: s.subject_id ?? "",
      title: s.title ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const subj = subjects.find((s: any) => s.id === form.subject_id);
      const title = form.title.trim() || subj?.name || "Atividade";
      const payload = {
        weekday: parseInt(form.weekday),
        start_time: form.start_time,
        end_time: form.end_time || null,
        subject_id: form.subject_id || null,
        title,
      };
      if (editingId) {
        const { error } = await supabase.from("schedule_slots").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Não autenticado");
        const { error } = await supabase.from("schedule_slots").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Horário atualizado" : "Horário adicionado");
      qc.invalidateQueries({ queryKey: ["schedule"] });
      setOpen(false); setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase.from("schedule_slots").delete().eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário excluído");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  const daysWithItems = WEEKDAYS.filter((d) => (grouped.get(d.idx) ?? []).length > 0 || d.idx === todayIdx);
  const emptyDays = WEEKDAYS.filter((d) => !daysWithItems.includes(d));

  return (
    <div className="max-w-6xl mx-auto">
      {confirmDialog}
      <PageHeader
        icon={CalendarRange}
        title="Cronograma semanal"
        description="Seus horários fixos de aula e estudo."
        action={<Button className="gap-2" onClick={() => openCreate()}><Plus className="size-4" />Adicionar horário</Button>}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar horário" : "Novo horário"}</DialogTitle>
            <DialogDescription>{editingId ? "Atualize a aula ou atividade." : "Adicione uma aula ou atividade ao seu cronograma fixo."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Select value={form.weekday} onValueChange={(v) => setForm((f) => ({ ...f, weekday: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d) => <SelectItem key={d.idx} value={String(d.idx)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Início</Label><Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Fim (opcional)</Label><Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>Matéria (opcional)</Label>
              <Select value={form.subject_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, subject_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Título (opcional)</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Revisão de Biologia" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!form.start_time || save.isPending}>{editingId ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar seu cronograma." description="Verifique sua conexão e tente recarregar a página." />
      ) : slots.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Nenhum horário cadastrado." description="Adicione seus horários fixos para ver o cronograma da semana." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {daysWithItems.map((d) => {
              const items = grouped.get(d.idx) ?? [];
              const isToday = d.idx === todayIdx;
              return (
                <section key={d.idx} className={`glass-card p-4 ${isToday ? "ring-1 ring-primary/40" : ""}`}>
                  <header className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold">{d.name}</h2>
                    {isToday && <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/15 px-2 py-0.5 rounded-full">Hoje</span>}
                  </header>
                  {items.length === 0 ? (
                    <button onClick={() => openCreate(d.idx)} className="w-full text-xs text-muted-foreground hover:text-primary py-4 text-center">
                      Sem horários · adicionar
                    </button>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((s: any) => {
                        const ongoing = isToday && s.start_time <= nowTime && (!s.end_time || nowTime <= s.end_time);
                        const body = (
                          <div className={`flex items-start gap-3 p-2.5 pr-16 rounded-lg transition ${ongoing ? "bg-primary/15 border border-primary/30" : "bg-muted/40 hover:bg-muted/70"}`}>
                            <span className="size-2 rounded-full mt-2 shrink-0" style={{ background: s.subjects?.color || "var(--primary)" }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Clock className="size-3" />
                                {s.start_time.slice(0, 5)}{s.end_time ? ` – ${s.end_time.slice(0, 5)}` : ""}
                              </p>
                              <p className="text-sm font-medium truncate">{s.title}</p>
                              {s.subjects && <p className="text-xs text-muted-foreground truncate">{s.subjects.name}</p>}
                            </div>
                          </div>
                        );
                        return (
                          <li key={s.id} className="relative">
                            {s.subject_id ? (
                              <Link to="/subjects/$id" params={{ id: s.subject_id }}>{body}</Link>
                            ) : body}
                            <div className="absolute top-1.5 right-1.5 flex gap-1">
                              <button
                                onClick={(e) => { e.preventDefault(); openEdit(s); }}
                                className="text-muted-foreground hover:text-primary p-1.5 rounded bg-background/60 backdrop-blur"
                                aria-label={`Editar horário ${s.title}`}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={async (e) => { e.preventDefault(); if (await confirm({ title: "Excluir horário", description: `Excluir "${s.title}" de ${d.name}?` })) remove.mutate(s.id); }}
                                className="text-muted-foreground hover:text-destructive p-1.5 rounded bg-background/60 backdrop-blur"
                                aria-label={`Excluir horário ${s.title}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {emptyDays.length > 0 && (
            <section className="glass-card p-4">
              <h2 className="text-sm font-medium mb-2">Dias sem horários</h2>
              <div className="flex flex-wrap gap-2">
                {emptyDays.map((d) => (
                  <button
                    key={d.idx}
                    onClick={() => openCreate(d.idx)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted inline-flex items-center gap-1.5"
                  >
                    <Plus className="size-3" />{d.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

