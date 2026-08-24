import {
  buildLearningStates,
  type LearningStateSourceEvent,
  type LearningStateSourceNote,
  type LearningStateSourceProficiency,
  type LearningStateSourceSession,
} from "./learning-state";

/** Loads the persisted facts required by the deterministic Learning State. */
export async function loadLearningStatesForUser(db: any, userId: string, subjectId?: string) {
  let notesQuery = db
    .from("content_cards")
    .select("id,subject_id,title,category,text_content,created_at,updated_at")
    .eq("user_id", userId)
    .eq("content_type", "text");
  if (subjectId) notesQuery = notesQuery.eq("subject_id", subjectId);
  const notesResult = await notesQuery;
  if (notesResult.error) throw notesResult.error;

  const noteIds = (notesResult.data ?? []).map((note: { id: string }) => note.id);
  if (noteIds.length === 0) return [];

  const [proficiencyResult, eventResult, sessionsResult] = await Promise.all([
    db.from("topic_proficiency").select("note_id,total_attempts,correct_attempts,last_reviewed").eq("user_id", userId).in("note_id", noteIds),
    db.from("learning_events").select("event_type,note_id,subject_id,occurred_at").eq("user_id", userId).in("note_id", noteIds).order("occurred_at", { ascending: false }),
    db.from("study_sessions").select("subject_id,completed,ended_at").eq("user_id", userId).eq("completed", true),
  ]);
  if (proficiencyResult.error) throw proficiencyResult.error;
  if (eventResult.error) throw eventResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  const notes: LearningStateSourceNote[] = (notesResult.data ?? []).map((note: any) => ({
    id: note.id,
    subjectId: note.subject_id,
    title: note.title,
    category: note.category,
    textContent: note.text_content,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  }));
  const proficiency: LearningStateSourceProficiency[] = (proficiencyResult.data ?? []).map((entry: any) => ({
    noteId: entry.note_id,
    totalAttempts: entry.total_attempts,
    correctAttempts: entry.correct_attempts,
    lastReviewedAt: entry.last_reviewed,
  }));
  const events: LearningStateSourceEvent[] = (eventResult.data ?? []).map((event: any) => ({
    type: event.event_type,
    noteId: event.note_id,
    subjectId: event.subject_id,
    occurredAt: event.occurred_at,
  }));
  const sessions: LearningStateSourceSession[] = (sessionsResult.data ?? []).map((session: any) => ({
    subjectId: session.subject_id,
    completed: session.completed,
    endedAt: session.ended_at,
  }));

  return buildLearningStates(notes, proficiency, events, sessions);
}
