import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { GraduationCap, Loader2 } from "lucide-react";

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  // Only same-origin relative paths.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Estudo+" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextPath = safeNext(next);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (nextPath) window.location.href = nextPath;
        else navigate({ to: "/dashboard" });
      }
    });
  }, [navigate, nextPath]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    if (nextPath) window.location.href = nextPath;
    else navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirect = nextPath
      ? `${window.location.origin}${nextPath}`
      : `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirect,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.08_290/40%),transparent_60%)]">
      <div className="w-full max-w-md glass-card p-8">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="size-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <GraduationCap className="size-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Estudo+</span>
        </Link>
        <h1 className="text-2xl font-semibold">Acesse sua conta</h1>
        <p className="text-sm text-muted-foreground mt-1">Organize suas matérias, tarefas e provas.</p>

        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="e1">E-mail</Label>
                <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p1">Senha</Label>
                <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="size-4 animate-spin mr-2" />} Entrar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="n2">Nome</Label>
                <Input id="n2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e2">E-mail</Label>
                <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p2">Senha</Label>
                <Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="size-4 animate-spin mr-2" />} Criar conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
