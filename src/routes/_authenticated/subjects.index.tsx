import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { Plus, BookOpen, Trash2, Search, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CardsSkeleton } from "@/components/ListSkeleton";
import { useConfirm } from "@/components/useConfirm";

export const Route = createFileRoute("/_authenticated/subjects/")({
  head: () => ({
    meta: [
      { title: "Matérias — Estudo+" },
      { name: "description", content: "Suas disciplinas, capítulos e materiais de estudo organizados em um só lugar." },
      { property: "og:title", content: "Matérias — Estudo+" },
      { property: "og:description", content: "Suas disciplinas, capítulos e materiais de estudo organizados em um só lugar." },
    ],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [search, setSearch] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#8b5cf6");

  const { data: subjects = [], isLoading, isError } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("subjects").insert({ user_id: user.id, name, color });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matéria criada");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      setName(""); setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Matéria excluída"); qc.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Nenhuma matéria selecionada");
      const { error } = await supabase.from("subjects").update({ name: editName, color: editColor }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matéria atualizada");
      qc.invalidateQueries({ queryKey: ["subjects"] });
      setEditOpen(false);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter((s: any) => s.name.toLowerCase().includes(q));
  }, [subjects, search]);

  return (
    <div className="max-w-5xl mx-auto">
      {confirmDialog}
      <PageHeader
        icon={BookOpen}
        title="Matérias"
        description="Suas disciplinas e conteúdos organizados."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" />Nova matéria</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova matéria</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label htmlFor="new-subject-name">Nome</Label><Input id="new-subject-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Matemática" /></div>
                <div className="space-y-2"><Label htmlFor="new-subject-color">Cor</Label><Input id="new-subject-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar matéria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-subject-name">Nome</Label><Input id="edit-subject-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Matemática" /></div>
            <div className="space-y-2"><Label htmlFor="edit-subject-color">Cor</Label><Input id="edit-subject-color" type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-10 w-20 p-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setEditOpen(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={() => update.mutate()} disabled={!editName || update.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar matéria..."
          aria-label="Buscar matéria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <CardsSkeleton cards={6} />
      ) : isError ? (
        <EmptyState icon={TriangleAlert} title="Não foi possível carregar suas matérias." description="Verifique sua conexão e tente recarregar a página." />
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhuma matéria ainda." description="Adicione sua primeira matéria para começar." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nenhuma matéria encontrada." description="Tente outro termo de busca." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s: any) => (
            <div key={s.id} className="glass-card p-5 group relative hover:border-primary/50 transition">
              <Link to="/subjects/$id" params={{ id: s.id }} className="block pr-16">
                <div className="size-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${s.color}33` }}>
                  <BookOpen className="size-5" style={{ color: s.color }} />
                </div>
                <h3 className="font-medium break-words">{s.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Ver conteúdos →</p>
              </Link>
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={() => { setEditingId(s.id); setEditName(s.name); setEditColor(s.color); setEditOpen(true); }}
                  className="p-1.5 rounded-md transition text-muted-foreground hover:text-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  aria-label={`Editar matéria ${s.name}`}
                ><Pencil className="size-4" /></button>
                <button
                  onClick={async () => { if (await confirm({ title: "Excluir matéria", description: `Excluir "${s.name}"? Os conteúdos vinculados também serão removidos.` })) remove.mutate(s.id); }}
                  className="p-1.5 rounded-md transition text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  aria-label={`Excluir matéria ${s.name}`}
                ><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
