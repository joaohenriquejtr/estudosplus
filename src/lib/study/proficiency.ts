import { supabase } from "@/integrations/supabase/client";

export async function recordFlashcardAttempt(noteId: string, acertou: boolean) {
  const { data, error } = await supabase.rpc("record_flashcard_attempt" as never, { p_note_id: noteId, p_correct: acertou } as never);
  if (error) throw error;
  return data;
}

export async function getWeakTopics(subjectId: string, limit = 10) {
  const { data, error } = await supabase.rpc("get_weak_topics" as never, { p_subject_id: subjectId, p_limit: limit } as never);
  if (error) throw error;
  return data;
}

export async function getProficiencyStats(subjectId: string) {
  const { data, error } = await supabase.rpc("get_proficiency_stats" as never, { p_subject_id: subjectId } as never);
  if (error) throw error;
  return data;
}
