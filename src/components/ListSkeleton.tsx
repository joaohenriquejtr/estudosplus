import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={`glass-card p-4 space-y-3 ${className ?? ""}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="glass-card p-5 space-y-3">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
