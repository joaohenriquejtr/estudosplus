import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Estudo+" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [notifEmail, setNotifEmail] = useState("");
  const [newSubject, setNewSubject] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setNotifEmail(profile.notification_email ?? "");
    }
  }, [profile]);

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("profiles").upsert({
        id: user.id, display_name: displayName, notification_email: notifEmail,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salvo!"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSubject = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("subjects").insert({ user_id: user.id, name: newSubject });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Matéria adicionada"); qc.invalidateQueries({ queryKey: ["subjects"] }); setNewSubject(""); },
  });

  const removeSubject = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("subjects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["subjects"] }); },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Perfil, notificações e matérias.</p>
      </div>

      <section className="glass-card p-5 space-y-4">
        <h2 className="font-medium">Perfil</h2>
        <div className="space-y-2"><Label>Nome</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>E-mail para notificações</Label>
          <Input type="email" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} placeholder="voce@exemplo.com" />
          <p className="text-xs text-muted-foreground">Você receberá lembretes 3 dias antes, 1 dia antes e no dia de cada prova ou entrega.</p>
        </div>
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}><Save className="size-4 mr-2" />Salvar</Button>
      </section>

      <section className="glass-card p-5 space-y-4">
        <h2 className="font-medium">Matérias</h2>
        <div className="flex gap-2">
          <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Nova matéria..." onKeyDown={(e) => e.key === "Enter" && newSubject && addSubject.mutate()} />
          <Button onClick={() => addSubject.mutate()} disabled={!newSubject || addSubject.isPending}><Plus className="size-4" /></Button>
        </div>
        <ul className="divide-y divide-border/60">
          {subjects.map((s: any) => (
            <li key={s.id} className="py-2 flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: s.color }} />
              <span className="flex-1">{s.name}</span>
              <button onClick={() => { if (confirm(`Remover "${s.name}"?`)) removeSubject.mutate(s.id); }} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {subjects.length === 0 && <p className="text-sm text-muted-foreground py-3">Nenhuma matéria ainda.</p>}
        </ul>
      </section>
    </div>
  );
}
