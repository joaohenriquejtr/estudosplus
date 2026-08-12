import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  durationSeconds: number;
  autoStart?: boolean;
  onComplete?: () => void;
};

/** Shared clock used by Focus mode and guided study sessions. */
export function usePomodoroTimer({ durationSeconds, autoStart = false, onComplete }: Options) {
  const [total, setTotal] = useState(durationSeconds);
  const [startedAt, setStartedAt] = useState<number | null>(autoStart ? Date.now() : null);
  const [elapsedBefore, setElapsedBefore] = useState(0);
  const [, setTick] = useState(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const running = startedAt !== null;
  const elapsed = elapsedBefore + (running ? (Date.now() - startedAt) / 1000 : 0);
  const remaining = Math.max(0, total - elapsed);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setTick((tick) => tick + 1), 500);
    return () => window.clearInterval(interval);
  }, [running]);

  const pause = useCallback(() => {
    setStartedAt((current) => {
      if (current !== null) setElapsedBefore((elapsed) => elapsed + (Date.now() - current) / 1000);
      return null;
    });
  }, []);

  const start = useCallback(() => {
    if (remaining <= 0) return;
    completedRef.current = false;
    setStartedAt((current) => current ?? Date.now());
  }, [remaining]);

  const reset = useCallback((nextDurationSeconds = durationSeconds, startImmediately = false) => {
    completedRef.current = false;
    setTotal(nextDurationSeconds);
    setElapsedBefore(0);
    setStartedAt(startImmediately ? Date.now() : null);
  }, [durationSeconds]);

  useEffect(() => {
    if (!running || remaining > 0 || completedRef.current) return;
    completedRef.current = true;
    setStartedAt(null);
    onCompleteRef.current?.();
  }, [remaining, running]);

  return { running, elapsed, remaining, total, start, pause, reset };
}
