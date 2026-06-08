import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tarefas — Estudo+" }] }),
  component: TasksPage,
});

const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_RANK: Record<string, number> = { alta: 3, media: 2, baixa: 1 };

type TaskForm = { title: string; subject_id: string; due_date: string; priority: string };
const EMPTY_FORM: TaskForm = { title: "", subject_id: "", due_date: "", priority: "media" };

function TasksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const { data: tasks = [] } = useQuery({
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
      toast.success(editingId ? "Tarefa atualizada!" : "Tarefa criada!");
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
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("tasks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Organize seus afazeres de estudo.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4 mr-2" />Nova tarefa</Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(EMPTY_FORM); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Editar tarefa" : "Nova tarefa"}</DialogTitle></DialogHeader>
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
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Matéria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as matérias</SelectItem>
            {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card divide-y divide-border/60">
        {sorted.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa.</p>}
        {sorted.map((t: any) => {
          const done = t.status === "concluida";
          return (
            <div key={t.id} className="p-4 flex items-center gap-3">
              <Checkbox
                checked={done}
                onCheckedChange={(v) => update.mutate({ id: t.id, patch: { status: v ? "concluida" : "pendente" } })}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {t.subjects && <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: t.subjects.color }} />{t.subjects.name}</span>}
                  {t.due_date && <span>{format(new Date(t.due_date + "T00:00:00"), "d MMM", { locale: ptBR })}</span>}
                  <span className={`px-2 py-0.5 rounded ${t.priority === "alta" ? "bg-destructive/20 text-destructive" : t.priority === "media" ? "bg-warning/20 text-warning" : "bg-muted"}`}>{PRIORITY_LABEL[t.priority]}</span>
                </div>
              </div>
              <Select value={t.status} onValueChange={(v) => update.mutate({ id: t.id, patch: { status: v } })}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={() => openEdit(t)} className="text-muted-foreground hover:text-primary p-1" aria-label="Editar">
                <Pencil className="size-4" />
              </button>
              <button onClick={() => { if (confirm("Remover?")) remove.mutate(t.id); }} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remover">
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
