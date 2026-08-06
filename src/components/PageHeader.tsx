import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ icon: Icon, title, description, action }: PageHeaderProps) {
  return (
    <header className="animate-fade-up mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border/60 pb-5 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative grid size-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="tech-label">// {title}</p>
          <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
