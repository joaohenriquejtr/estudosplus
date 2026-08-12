import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ChevronDown, ChevronUp, X, Search, Pencil, CalendarDays, TriangleAlert, Brain, Sparkles, BookOpen, Target } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useConfirm } from "@/components/useConfirm";
import { addExamGapsToDailyPlan, analyzeExam, createExamTopicStub, extractExamTopics, getExamTopics, replaceExamTopics, type ExamTopicAnalysis } from "@/lib/api/exam-analysis.functions";

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

type EventForm = { title: string; subjectIds: string[]; date: string; type: string; notes: string };
type TopicDraft = { subjectId: string; name: string };
const EMPTY: EventForm = { title: "", subjectIds: [], date: "", type: "prova", notes: "" };

const STATUS_STYLE: Record<ExamTopicAnalysis["status"], { dot: string; label: string }> = {
  HIGH: { dot: "bg-green-500", label: "domínio alto" },
  MEDIUM: { dot: "bg-yellow-500", label: "domínio médio" },
  LOW: { dot: "bg-red-500", label: "domínio baixo" },
  NOT_STUDIED: { dot: "bg-muted-foreground", label: "não estudado" },
};

function ExamAnalysisPanel({ event }: { event: any }) {
  const [showPlan, setShowPlan] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["exam-analysis", event.id], queryFn: () => analyzeExam({ data: { eventId: event.id } }) });
  const createStub = useMutation({
    mutationFn: (topicId: string) => createExamTopicStub({ data: { eventId: event.id, topicId } }),
    onSuccess: ({ noteId, subjectId, created }) => {
      toast.success(created ? "Nota vazia criada." : "A nota deste tópico já existia.");
      window.location.assign(`/subjects/${subjectId}?note=${noteId}`);
    },
    onError: (problem: Error) => toast.error(problem.message),
  });
  const addToPlan = useMutation({
    mutationFn: () => addExamGapsToDailyPlan({ data: { eventId: event.id } }),
    onSuccess: ({ added }) => toast.success(added ? `${added} tópico(s) adicionado(s) ao plano de hoje.` : "Esses tópicos já estão no plano de hoje."),
    onError: (problem: Error) => toast.error(problem.message),
  });

  if (isLoading) return <p className="mt-3 text-xs text-muted-foreground">Analisando seu preparo…</p>;
  if (error) return <p className="mt-3 text-xs text-destructive">{(error as Error).message}</p>;
  if (!data?.topics.length) return <p className="mt-3 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">Adicione o conteúdo cobrado e sugira os tópicos ao editar esta prova para gerar a análise.</p>;

  return <section className="mt-3 border-l-2 border-primary bg-[#1a1a24] p-3 sm:p-4">
    <div className="flex items-center gap-2"><Target className="size-4 text-primary" /><h4 className="text-sm font-semibold">Análise de preparo</h4><span className="ml-auto text-sm font-semibold text-primary">{data.overallCoverage}%</span></div>
    <p className="mt-1 text-xs text-muted-foreground">Você cobriu {data.overallCoverage}% dos tópicos desta prova.</p>
    <Progress value={data.overallCoverage} className="mt-3 bg-[#2a2a3a]" />
    <ul className="mt-4 space-y-3">
      {data.topics.map((topic) => {
        const style = STATUS_STYLE[topic.status];
        const note = topic.relatedNotes[0];
        return <li key={topic.id} className="rounded-md bg-background/40 p-2.5">
          <div className="flex items-start gap-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${style.dot}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-1.5"><span className="font-medium text-sm">{topic.name}</span><span className="text-xs text-muted-foreground">— {style.label}{topic.status !== "NOT_STUDIED" ? ` (${topic.score}/100)` : ""}</span></div><p className="mt-1 text-xs text-muted-foreground">{topic.evidence.join(" · ")}</p>{note ? <Link to="/subjects/$id" params={{ id: topic.subjectId }} search={{ note: note.id }} className="mt-2 inline-flex text-xs text-primary hover:underline">Abrir {note.title} →</Link> : <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" disabled={createStub.isPending} onClick={() => createStub.mutate(topic.id)}><BookOpen className="size-3" />Criar nota</Button>}</div></div>
        </li>;
      })}
    </ul>
    {data.suggestedPlan && <div className="mt-4"><Button variant="ghost" size="sm" className="h-auto px-0 text-xs text-primary" onClick={() => setShowPlan((value) => !value)}>📝 Ver plano sugerido {showPlan ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}</Button>{showPlan && <p className="mt-2 whitespace-pre-line rounded-md bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">{data.suggestedPlan}</p>}</div>}
    <Button size="sm" className="mt-4 w-full sm:w-auto" disabled={addToPlan.isPending} onClick={() => addToPlan.mutate()}>{addToPlan.isPending ? "Adicionando…" : "📋 Adicionar ao plano de hoje"}</Button>
  </section>;
}

function CalendarPage() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY);
  const [topicDrafts, setTopicDrafts] = useState<TopicDraft[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [newTopicSubjectId, setNewTopicSubjectId] = useState("");
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
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

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setTopicDrafts([]); setNewTopic(""); setNewTopicSubjectId(""); setOpen(true); };
  const openEdit = async (e: any) => {
    setEditingId(e.id);
    setForm({
      title: e.title,
      subjectIds: e.subjectsList.map((s: any) => s.id),
      date: e.event_date,
      type: e.event_type,
      notes: e.notes ?? "",
    });
    setTopicDrafts([]); setNewTopic(""); setNewTopicSubjectId(e.subjectsList[0]?.id ?? "");
    setOpen(true);
    if (e.event_type === "prova") {
      try { setTopicDrafts(await getExamTopics({ data: { eventId: e.id } })); }
      catch (problem) { toast.error((problem as Error).message); }
    }
  };

  const suggestTopics = useMutation({
    mutationFn: () => {
      const selectedSubjects = subjects.filter((subject: any) => form.subjectIds.includes(subject.id)).map((subject: any) => ({ id: subject.id, name: subject.name }));
      return extractExamTopics({ data: { title: form.title, content: form.notes, subjects: selectedSubjects } });
    },
    onSuccess: (topics) => { setTopicDrafts(topics); toast.success("Tópicos sugeridos. Revise antes de salvar."); },
    onError: (problem: Error) => toast.error(problem.message || "Não foi possível sugerir os tópicos."),
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        title: form.title,
        subject_id: form.subjectIds[0] || null,
        event_date: form.date,
        event_type: form.type,
        notes: form.notes.trim() || null,
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
      if (form.type === "prova" && eventId && (editingId || topicDrafts.length > 0)) await replaceExamTopics({ data: { eventId, topics: topicDrafts } });
      return eventId;
    },
    onSuccess: () => {
      toast.success(editingId ? "Data atualizada" : "Data cadastrada");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-subjects"] });
      qc.invalidateQueries({ queryKey: ["exam-analysis"] });
      setForm(EMPTY); setTopicDrafts([]); setOpen(false); setEditingId(null);
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
    setTopicDrafts((topics) => topics.filter((topic) => topic.subjectId !== id));
  };

  const addTopic = () => {
    const name = newTopic.trim();
    const subjectId = newTopicSubjectId || form.subjectIds[0];
    if (!name || !subjectId) return;
    if (!topicDrafts.some((topic) => topic.subjectId === subjectId && topic.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) setTopicDrafts((topics) => [...topics, { subjectId, name }]);
    setNewTopic("");
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
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(EMPTY); setTopicDrafts([]); } }}>
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
                {form.type === "prova" && <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
                  <div className="space-y-2"><Label>Conteúdo cobrado <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea value={form.notes} rows={4} placeholder="Ex.: Mitose, meiose, teste STR e aplicações de DNA…" onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} /><p className="text-xs text-muted-foreground">Sem esse conteúdo, a análise de preparo não consegue identificar os tópicos da prova.</p></div>
                  <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" disabled={!form.title.trim() || !form.notes.trim() || form.subjectIds.length === 0 || suggestTopics.isPending} onClick={() => suggestTopics.mutate()}><Sparkles className="size-3.5" />{suggestTopics.isPending ? "Sugerindo tópicos…" : "Sugerir tópicos com IA"}</Button>
                  {topicDrafts.length > 0 && <div className="space-y-2"><p className="text-xs font-medium">Tópicos confirmados</p><div className="space-y-2">{topicDrafts.map((topic, index) => { const subject = subjects.find((item: any) => item.id === topic.subjectId); return <div key={`${topic.subjectId}-${index}`} className="flex gap-2"><Input value={topic.name} aria-label="Nome do tópico" className="h-8 text-xs" onChange={(e) => setTopicDrafts((topics) => topics.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} /><span className="hidden shrink-0 self-center text-xs text-muted-foreground sm:inline">{subject?.name}</span><Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setTopicDrafts((topics) => topics.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${topic.name}`}><X className="size-3.5" /></Button></div>; })}</div><div className="flex gap-2"><Input value={newTopic} className="h-8 text-xs" placeholder="Adicionar tópico" onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} />{form.subjectIds.length > 1 && <Select value={newTopicSubjectId} onValueChange={setNewTopicSubjectId}><SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent>{form.subjectIds.map((subjectId) => <SelectItem key={subjectId} value={subjectId}>{subjects.find((subject: any) => subject.id === subjectId)?.name ?? "Matéria"}</SelectItem>)}</SelectContent></Select>}<Button type="button" size="sm" variant="outline" className="h-8" onClick={addTopic}>Adicionar</Button></div></div>}
                </div>}
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
                <li key={e.id} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-start gap-3">
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
                    {e.event_type === "prova" && <button onClick={() => setExpandedExamId((current) => current === e.id ? null : e.id)} className="text-muted-foreground hover:text-primary p-1" aria-label={`Análise de preparo de ${e.title}`}><Brain className="size-4" /></button>}
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
                  </div>
                  {e.event_type === "prova" && expandedExamId === e.id && <ExamAnalysisPanel event={e} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
