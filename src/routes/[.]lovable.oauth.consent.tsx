import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2 } from "lucide-react";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string | null;
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};
const oauthApi = () =>
  (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [{ title: "Autorizar acesso — Estudo+" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id:
      typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get(
      "authorization_id",
    )!;
    const { data, error } = await oauthApi().getAuthorizationDetails(
      authorizationId,
    );
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Não foi possível carregar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "Aplicativo externo";

  async function decide(approve: boolean) {
    setBusy(true);
    setErr(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setErr("O provedor não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.08_290/40%),transparent_60%)]">
      <div className="w-full max-w-md glass-card p-8 space-y-6">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <GraduationCap className="size-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Estudo+</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            Conectar {clientName} à sua conta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Isso permite que {clientName} use as ferramentas do Estudo+ agindo
            como você — consultar matérias, tarefas, cronograma e provas, e
            criar novas tarefas.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            As permissões do app continuam valendo: {clientName} só pode
            acessar dados que sua conta já pode acessar.
          </p>
        </div>
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => decide(true)}
            disabled={busy}
            className="flex-1"
          >
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            Autorizar
          </Button>
          <Button
            onClick={() => decide(false)}
            disabled={busy}
            variant="outline"
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </main>
  );
}
