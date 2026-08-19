import { supabase } from "@/integrations/supabase/client";

export const LEARNING_EVENT_TYPES = [
  "NOTE_VIEWED",
  "NOTE_REVIEWED",
  "FLASHCARD_CORRECT",
  "FLASHCARD_INCORRECT",
  "SOCRATIC_SESSION",
  "EXERCISE_COMPLETED",
  "STUDY_SESSION_COMPLETED",
  "PLAN_ITEM_COMPLETED",
  "PLAN_ITEM_SKIPPED",
  "PLAN_ITEM_DEFERRED",
  "PLAN_ITEM_REPLACED",
] as const;

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

export type LearningEventInput = {
  type: LearningEventType;
  noteId?: string | null;
  subjectId?: string | null;
  /** Small non-sensitive facts for the future learning-state layer. */
  metadata?: Record<string, boolean | number | string | null>;
};

const recentEvents = new Map<string, number>();
const VIEW_DEDUPLICATION_MS = 60_000;

/**
 * Persists an observed learning event. Tracking is intentionally best-effort:
 * it must never block studying, saving notes, or answering flashcards.
 */
export async function recordLearningEvent(input: LearningEventInput): Promise<void> {
  const deduplicationKey = input.type === "NOTE_VIEWED" && input.noteId
    ? `${input.type}:${input.noteId}`
    : null;
  const now = Date.now();
  if (deduplicationKey && now - (recentEvents.get(deduplicationKey) ?? 0) < VIEW_DEDUPLICATION_MS) return;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return;

  const { error } = await (supabase as any).from("learning_events").insert({
    user_id: user.id,
    event_type: input.type,
    note_id: input.noteId ?? null,
    subject_id: input.subjectId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
  if (deduplicationKey) recentEvents.set(deduplicationKey, now);
}

/** Records a note opening without affecting the interaction if tracking fails. */
export function trackNoteViewed(noteId: string, subjectId: string | null | undefined): void {
  void recordLearningEvent({ type: "NOTE_VIEWED", noteId, subjectId }).catch((error) => {
    console.warn("Learning event tracking failed", { type: "NOTE_VIEWED", message: error instanceof Error ? error.message : "Unknown error" });
  });
}
