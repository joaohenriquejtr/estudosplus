import { findMissingWikiReferences } from "./wiki-gaps";

/** Loads only the fields needed to detect broken wikilinks owned by the user. */
export async function loadMissingWikiReferencesForUser(db: any, userId: string, subjectId?: string) {
  let query = db
    .from("content_cards")
    .select("id,subject_id,title,text_content")
    .eq("user_id", userId)
    .eq("content_type", "text");
  if (subjectId) query = query.eq("subject_id", subjectId);
  const result = await query;
  if (result.error) throw result.error;

  return findMissingWikiReferences((result.data ?? []).map((note: any) => ({
    id: note.id,
    subjectId: note.subject_id,
    title: note.title,
    textContent: note.text_content,
  })));
}
