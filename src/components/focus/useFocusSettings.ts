import { useEffect, useState } from "react";

export type FocusMode = "focus" | "short_break" | "long_break";

export type FocusSettings = {
  focus: number; // minutos
  short_break: number;
  long_break: number;
  sound: boolean;
};

export const DEFAULT_SETTINGS: FocusSettings = {
  focus: 25,
  short_break: 5,
  long_break: 15,
  sound: true,
};

export const MODE_LABEL: Record<FocusMode, string> = {
  focus: "Foco",
  short_break: "Pausa curta",
  long_break: "Pausa longa",
};

const KEY = "estudo+.focus.settings";

/** Configurações do Pomodoro persistidas no navegador (lidas após hidratar). */
export function useFocusSettings() {
  const [settings, setSettings] = useState<FocusSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* ignora storage indisponível */
    }
  }, []);

  const update = (patch: Partial<FocusSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  };

  return { settings, update };
}

export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.4);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* som opcional */
  }
}

export function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") new Notification(title, { body });
    else if (Notification.permission === "default") void Notification.requestPermission();
  } catch {
    /* notificação opcional */
  }
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds: number) {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
