import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

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

function SchedulePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ weekday: "1", start_time: "08:00", end_time: "", subject_id: "", title: "" });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: slots = [] } = useQuery({
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

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const subj = subjects.find((s: any) => s.id === form.subject_id);
      const title = form.title.trim() || subj?.name || "Atividade";
      const { error } = await supabase.from("schedule_slots").insert({
        user_id: user.id,
        weekday: parseInt(form.weekday),
        start_time: form.start_time,
        end_time: form.end_time || null,
        subject_id: form.subject_id || null,
        title,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário adicionado!");
      qc.invalidateQueries({ queryKey: ["schedule"] });
      setOpen(false);
      setForm({ weekday: form.weekday, start_time: "08:00", end_time: "", subject_id: "", title: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase.from("schedule_slots").delete().eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <CalendarRange className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Cronograma semanal</h1>
          <p className="text-sm text-muted-foreground">Seus horários fixos. Edite manualmente quando quiser.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" />Adicionar horário</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo horário</DialogTitle>
              <DialogDescription>Adicione uma aula ou atividade ao seu cronograma fixo.</DialogDescription>
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
              <Button onClick={() => create.mutate()} disabled={!form.start_time || create.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {WEEKDAYS.map((d) => {
          const items = grouped.get(d.idx) ?? [];
          const isToday = d.idx === todayIdx;
          return (
            <section key={d.idx} className={`glass-card p-4 ${isToday ? "ring-1 ring-primary/40" : ""}`}>
              <header className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{d.name}</h2>
                {isToday && <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/15 px-2 py-0.5 rounded-full">Hoje</span>}
              </header>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Sem horários</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((s: any) => {
                    const ongoing = isToday && s.start_time <= nowTime && (!s.end_time || nowTime <= s.end_time);
                    const inner = (
                      <div className={`flex items-start gap-3 p-2.5 rounded-lg transition ${ongoing ? "bg-primary/15 border border-primary/30" : "bg-muted/40 hover:bg-muted/70"}`}>
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
                      <li key={s.id} className="group relative">
                        {s.subject_id ? (
                          <Link to="/subjects/$id" params={{ id: s.subject_id }}>{inner}</Link>
                        ) : inner}
                        <button
                          onClick={() => { if (confirm("Remover?")) remove.mutate(s.id); }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
