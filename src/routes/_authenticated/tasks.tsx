import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, ListChecks, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { useConfirm } from "@/components/useConfirm";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tarefas — Estudo+" },
      { name: "description", content: "Organize suas tarefas de estudo por matéria, prazo e prioridade." },
      { property: "og:title", content: "Tarefas — Estudo+" },
      { property: "og:description", content: "Organize suas tarefas de estudo por matéria, prazo e prioridade." },
    ],
  }),
  component: TasksPage,
});

const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_RANK: Record<string, number> = { alta: 3, media: 2, baixa: 1 };

type TaskForm = { title: string; subject_id: string; due_date: string; priority: string };
const EMPTY_FORM: TaskForm = { title: "", subject_id: "", due_date: "", priority: "media" };

function TasksPage() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const { data: tasks = [], isLoading, isError } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*, subjects(name,color)").order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const sorted = useMemo(() => {
    let list = [...tasks];
    if (filterSubject !== "all") list = list.filter((t: any) => t.subject_id === filterSubject);
    if (filterStatus !== "all") list = list.filter((t: any) => t.status === filterStatus);
    list.sort((a: any, b: any) => {
      if (a.status === "concluida" && b.status !== "concluida") return 1;
      if (b.status === "concluida" && a.status !== "concluida") return -1;
      const dp = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (dp !== 0) return dp;
      return (a.due_date ?? "") > (b.due_date ?? "") ? 1 : -1;
    });
    return list;
  }, [tasks, filterSubject, filterStatus]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({ title: t.title, subject_id: t.subject_id ?? "", due_date: t.due_date ?? "", priority: t.priority });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        subject_id: form.subject_id || null,
        due_date: form.due_date || null,
        priority: form.priority,
      };
      if (editingId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Não autenticado");
        const { error } = await supabase.from("tasks").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Tarefa atualizada" : "Tarefa criada");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false); setEditingId(null); setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Tarefa excluída"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto">
      {confirmDialog}
      <PageHeader
        icon={ListChecks}
        title="Tarefas"
        description="Afazeres do dia a dia: leituras, exercícios e entregas curtas."
        action={<Button onClick={openCreate}><Plus className="size-4 mr-2" />Nova tarefa</Button>}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
            <DialogDescription>Use Tarefas para afazeres do dia a dia. Provas e trabalhos com data marcada ficam em Provas &amp; Datas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Matéria</Label>
              <Select value={form.subject_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, subject_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Entrega</Label><Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>{editingId ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-2 mb-4 sm:flex sm:flex-wrap">
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Matéria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as matérias</SelectItem>
            {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar suas tarefas." description="Verifique sua conexão e tente recarregar a página." />
      ) : sorted.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nenhuma tarefa por aqui." description="Crie uma tarefa para acompanhar leituras, exercícios e entregas." />
      ) : (
        <div className="glass-card divide-y divide-border/60">
          {sorted.map((t: any) => {
            const done = t.status === "concluida";
            return (
              <div key={t.id} className="p-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:flex sm:items-center">
                <Checkbox
                  className="mt-1 sm:mt-0"
                  checked={done}
                  aria-label={done ? "Marcar como pendente" : "Marcar como concluída"}
                  onCheckedChange={(v) => update.mutate({ id: t.id, patch: { status: v ? "concluida" : "pendente" } })}
                />
                <div className="min-w-0 sm:flex-1">
                  <p className={`text-sm font-medium break-words ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                    {t.subjects && <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full shrink-0" style={{ background: t.subjects.color }} />{t.subjects.name}</span>}
                    {t.due_date && <span>{format(new Date(t.due_date + "T00:00:00"), "d MMM", { locale: ptBR })}</span>}
                    <span className={`px-2 py-0.5 rounded ${t.priority === "alta" ? "bg-destructive/20 text-destructive" : t.priority === "media" ? "bg-warning/20 text-warning" : "bg-muted"}`}>{PRIORITY_LABEL[t.priority]}</span>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:shrink-0">
                  <Select value={t.status} onValueChange={(v) => update.mutate({ id: t.id, patch: { status: v } })}>
                    <SelectTrigger className="flex-1 h-9 text-xs sm:w-36 sm:flex-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => openEdit(t)} className="text-muted-foreground hover:text-primary p-2" aria-label="Editar tarefa">
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={async () => { if (await confirm({ title: "Excluir tarefa", description: `Excluir "${t.title}"?` })) remove.mutate(t.id); }}
                    className="text-muted-foreground hover:text-destructive p-2"
                    aria-label="Excluir tarefa"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
