import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={`glass-card animate-fade-up relative overflow-hidden p-10 text-center ${className ?? ""}`}
    >
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative">
        <div className="mx-auto grid size-12 place-items-center rounded-md border border-border bg-muted/40">
          <Icon className="size-5 text-primary" />
        </div>
        <p className="tech-label mt-4">vazio</p>
        <p className="mt-1 font-display font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
