import { formatClock } from "./useFocusSettings";

type Props = {
  remaining: number;
  total: number;
  label: string;
  running: boolean;
};

export function TimerRing({ remaining, total, label, running }: Props) {
  const size = 240;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;

  return (
    <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border/50" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          className="text-primary transition-[stroke-dashoffset] duration-500 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="tech-label text-[0.6rem]">{label}</span>
        <span className="font-display text-5xl font-semibold tabular-nums tracking-tight" role="timer" aria-live="off">
          {formatClock(remaining)}
        </span>
        <span className="tech-label mt-1 flex items-center justify-center gap-1.5 text-[0.6rem] opacity-70">
          <span className={`size-1.5 rounded-full ${running ? "animate-sheen bg-primary" : "bg-muted-foreground/50"}`} />
          {running ? "em andamento" : "pausado"}
        </span>
      </div>
    </div>
  );
}
