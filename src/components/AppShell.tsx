import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { LayoutDashboard, BookOpen, ListChecks, CalendarDays, CalendarRange, Settings, GraduationCap, LogOut, Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const items = [
  { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Matérias", url: "/subjects", icon: BookOpen },
  { title: "Grafo de notas", url: "/graph", icon: Network },
  { title: "Tarefas", url: "/tasks", icon: ListChecks },
  { title: "Cronograma", url: "/schedule", icon: CalendarRange },
  { title: "Provas & Datas", url: "/calendar", icon: CalendarDays },
  { title: "Configurações", url: "/settings", icon: Settings },
];

function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu.");
    navigate({ to: "/auth" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10">
            <GraduationCap className="size-4 text-primary" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate font-display text-sm font-semibold tracking-tight">Estudo+</span>
            <span className="tech-label block text-[0.6rem]">sistema de estudos</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item, i) => {
                const active = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="group/nav transition-all duration-200">
                        <item.icon className={`size-4 transition-transform duration-200 group-hover/nav:scale-110 ${active ? "text-primary" : ""}`} />
                        <span className="truncate">{item.title}</span>
                        <span className="tech-label ml-auto text-[0.6rem] opacity-40 group-data-[collapsible=icon]:hidden">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-2">
          <LogOut className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const current = items.find((i) => pathname.startsWith(i.url))?.title ?? "Estudo+";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border/60 bg-background/75 px-3 backdrop-blur">
            <SidebarTrigger />
            <span className="tech-label truncate">estudo+ / {current}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="animate-sheen size-1.5 rounded-full bg-primary" />
              <span className="tech-label hidden text-[0.6rem] sm:inline">online</span>
            </span>
          </header>
          <main className="relative flex-1 overflow-x-hidden p-4 md:p-8">
            <div className="grid-backdrop pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40" aria-hidden />
            <div className="relative animate-rise">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

