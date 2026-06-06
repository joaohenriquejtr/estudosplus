import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState, useMemo } from "react";
import { Plus, BookOpen, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subjects/")({
  head: () => ({ meta: [{ title: "Matérias — Estudo+" }] }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [search, setSearch] = useState("");

  const { data: subjects = [] } = useQuery({
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
      toast.success("Matéria criada!");
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
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["subjects"] }); },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter((s: any) => s.name.toLowerCase().includes(q));
  }, [subjects, search]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Matérias</h1>
          <p className="text-sm text-muted-foreground">Suas disciplinas e conteúdos organizados.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Nova matéria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova matéria</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Matemática" /></div>
              <div className="space-y-2"><Label>Cor</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar matéria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {subjects.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <BookOpen className="size-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Adicione sua primeira matéria para começar.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s: any) => (
            <div key={s.id} className="glass-card p-5 group relative hover:border-primary/50 transition">
              <Link to="/subjects/$id" params={{ id: s.id }} className="block">
                <div className="size-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${s.color}33` }}>
                  <BookOpen className="size-5" style={{ color: s.color }} />
                </div>
                <h3 className="font-medium">{s.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Ver conteúdos →</p>
              </Link>
              <button
                onClick={() => { if (confirm(`Remover "${s.name}"?`)) remove.mutate(s.id); }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
              ><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
