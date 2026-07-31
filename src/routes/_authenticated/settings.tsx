import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings as SettingsIcon, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — Estudo+" },
      { name: "description", content: "Ajuste seu perfil e o e-mail que recebe lembretes de provas e entregas." },
      { property: "og:title", content: "Configurações — Estudo+" },
      { property: "og:description", content: "Ajuste seu perfil e o e-mail que recebe lembretes de provas e entregas." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [notifEmail, setNotifEmail] = useState("");

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
    onSuccess: () => { toast.success("Alterações salvas"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader icon={SettingsIcon} title="Configurações" description="Perfil e notificações por e-mail." />

      <div className="space-y-6">
        <section className="glass-card p-5 space-y-4">
          <h2 className="font-medium">Perfil</h2>
          <div className="space-y-2"><Label htmlFor="display-name">Nome</Label><Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div className="space-y-2">
            <Label htmlFor="notif-email">E-mail para notificações</Label>
            <Input id="notif-email" type="email" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} placeholder="voce@exemplo.com" />
            <p className="text-xs text-muted-foreground">Você receberá lembretes 3 dias antes, 1 dia antes e no dia de cada prova ou entrega.</p>
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}><Save className="size-4 mr-2" />Salvar</Button>
        </section>

        <section className="glass-card p-5 space-y-3">
          <h2 className="font-medium">Matérias</h2>
          <p className="text-sm text-muted-foreground">
            Você tem {subjects.length} matéria{subjects.length === 1 ? "" : "s"} cadastrada{subjects.length === 1 ? "" : "s"}.
            Criar, renomear e excluir matérias acontece na aba Matérias, para manter tudo em um só lugar.
          </p>
          <Button asChild variant="secondary">
            <Link to="/subjects"><BookOpen className="size-4 mr-2" />Gerenciar matérias</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
