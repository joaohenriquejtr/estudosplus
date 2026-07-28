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
          <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <GraduationCap className="size-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">Estudo+</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
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
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/60 px-3 sticky top-0 bg-background/80 backdrop-blur z-10">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
