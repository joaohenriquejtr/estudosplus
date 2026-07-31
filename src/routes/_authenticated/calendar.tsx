import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ChevronDown, X, Search, Pencil, CalendarDays, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useConfirm } from "@/components/useConfirm";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Provas & Datas — Estudo+" },
      { name: "description", content: "Calendário de provas, trabalhos e apresentações, com lembretes por e-mail." },
      { property: "og:title", content: "Provas & Datas — Estudo+" },
      { property: "og:description", content: "Calendário de provas, trabalhos e apresentações, com lembretes por e-mail." },
    ],
  }),
  component: CalendarPage,
});

const TYPE_LABEL: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", apresentacao: "Apresentação", outro: "Outro" };

type EventForm = { title: string; subjectIds: string[]; date: string; type: string };
const EMPTY: EventForm = { title: "", subjectIds: [], date: "", type: "prova" };

function CalendarPage() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const { data: rawEvents = [], isLoading, isError } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: eventSubjects = [] } = useQuery({
    queryKey: ["event-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_subjects").select("event_id, subject_id, subjects(name,color)").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
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

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      subjectIds: e.subjectsList.map((s: any) => s.id),
      date: e.event_date,
      type: e.event_type,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        title: form.title,
        subject_id: form.subjectIds[0] || null,
        event_date: form.date,
        event_type: form.type,
      };
      let eventId = editingId;
      if (editingId) {
        const { error } = await supabase.from("events").update(payload).eq("id", editingId);
        if (error) throw error;
        const { error: delErr } = await supabase.from("event_subjects").delete().eq("event_id", editingId);
        if (delErr) throw delErr;
      } else {
        const { data: eventData, error } = await supabase.from("events").insert({ ...payload, user_id: user.id }).select("id").single();
        if (error) throw error;
        eventId = eventData.id;
      }
      if (form.subjectIds.length > 0 && eventId) {
        const rows = form.subjectIds.map((sid) => ({ event_id: eventId!, subject_id: sid, user_id: user.id }));
        const { error: esError } = await supabase.from("event_subjects").insert(rows);
        if (esError) throw esError;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Data atualizada" : "Data cadastrada");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-subjects"] });
      setForm(EMPTY); setOpen(false); setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: esError } = await supabase.from("event_subjects").delete().eq("event_id", id);
      if (esError) throw esError;
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Data excluída");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-subjects"] });
    },
  });

  const eventDates = events.map((e: any) => parseISO(e.event_date));
  const dayEvents = selected ? events.filter((e: any) => isSameDay(parseISO(e.event_date), selected)) : [];

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return dayEvents;
    const q = search.toLowerCase();
    return events.filter((e: any) =>
      e.title.toLowerCase().includes(q) ||
      e.subjectsList.some((s: any) => s.name.toLowerCase().includes(q))
    );
  }, [events, dayEvents, search]);

  const toggleSubject = (id: string) => {
    setForm((f) => ({ ...f, subjectIds: f.subjectIds.includes(id) ? f.subjectIds.filter((x) => x !== id) : [...f.subjectIds, id] }));
  };

  return (
    <div className="max-w-5xl mx-auto">
      {confirmDialog}
      <PageHeader
        icon={CalendarDays}
        title="Provas & Datas"
        description="Compromissos com data marcada: provas, trabalhos e apresentações."
        action={<Button onClick={openCreate}><Plus className="size-4 mr-2" />Nova data</Button>}
      />
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(EMPTY); } }}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "Editar data" : "Nova data"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Matérias</Label>
                  <Popover open={subjectsOpen} onOpenChange={setSubjectsOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {form.subjectIds.length === 0 ? "Selecione as matérias" : `${form.subjectIds.length} matéria${form.subjectIds.length > 1 ? "s" : ""} selecionada${form.subjectIds.length > 1 ? "s" : ""}`}
                        </span>
                        <ChevronDown className="size-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-2">
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {subjects.map((s: any) => (
                          <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm">
                            <Checkbox checked={form.subjectIds.includes(s.id)} onCheckedChange={() => toggleSubject(s.id)} />
                            <span className="flex-1">{s.name}</span>
                            <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {form.subjectIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {form.subjectIds.map((sid) => {
                        const s = subjects.find((x: any) => x.id === sid);
                        if (!s) return null;
                        return (
                          <span key={sid} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs bg-muted/60">
                            <span className="size-1.5 rounded-full" style={{ background: s.color || "var(--primary)" }} />
                            {s.name}
                            <button onClick={() => toggleSubject(sid)} className="ml-0.5 hover:text-destructive"><X className="size-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prova">Prova</SelectItem>
                        <SelectItem value="trabalho">Trabalho</SelectItem>
                        <SelectItem value="apresentacao">Apresentação</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.title || !form.date || save.isPending}>{editingId ? "Salvar" : "Criar"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prova, trabalho ou matéria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-[auto_1fr] gap-6">
        <div className="glass-card p-3 self-start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{ hasEvent: "relative font-bold text-primary after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary" }}
            className="pointer-events-auto"
            locale={ptBR}
          />
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3">
            {search.trim() ? "Resultados da busca" : selected ? format(selected, "EEEE, d 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
          </h3>
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : isError ? (
            <EmptyState icon={TriangleAlert} title="Não foi possível carregar suas datas." description="Verifique sua conexão e tente recarregar a página." />
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.trim() ? "Nenhum resultado encontrado." : "Nenhum evento neste dia."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredEvents.map((e: any) => (
                <li key={e.id} className="p-3 rounded-lg bg-muted/40 flex items-start gap-3">
                  <span className="size-2 rounded-full mt-2 shrink-0" style={{ background: (e.subjectsList[0]?.color as string | undefined) || "var(--primary)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{e.title}</p>
                    {search.trim() && <p className="text-[11px] text-muted-foreground mt-0.5">{format(parseISO(e.event_date), "d MMM yyyy", { locale: ptBR })}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {e.subjectsList.length > 0 ? (
                        e.subjectsList.map((s: any) => (
                          <span key={s.id} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-muted/60 border">
                            <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                            {s.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <span className="text-xs text-muted-foreground">· {TYPE_LABEL[e.event_type]}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(e)} className="text-muted-foreground hover:text-primary p-1" aria-label={`Editar ${e.title}`}>
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={async () => { if (await confirm({ title: "Excluir data", description: `Excluir "${e.title}" do calendário?` })) remove.mutate(e.id); }}
                      className="text-muted-foreground hover:text-destructive p-1"
                      aria-label={`Excluir ${e.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
