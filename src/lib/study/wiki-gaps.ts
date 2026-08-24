import { extractWikiLinks, normalizeNoteTitle } from "@/lib/note-links";

export type WikiGapSourceNote = {
  id: string;
  subjectId: string;
  title: string | null;
  textContent: string | null;
};

export type MissingWikiReference = {
  title: string;
  normalizedTitle: string;
  subjectId: string;
  referenceCount: number;
  sourceNoteIds: string[];
};

/**
 * Finds literal [[wikilinks]] that have no note with the same title in the
 * same subject. It does not infer semantic links or create any note.
 */
export function findMissingWikiReferences(notes: WikiGapSourceNote[]): MissingWikiReference[] {
  const existingTitles = new Set(
    notes
      .filter((note) => Boolean(note.title?.trim()))
      .map((note) => `${note.subjectId}:${normalizeNoteTitle(note.title ?? "")}`),
  );
  const gaps = new Map<string, MissingWikiReference>();

  for (const note of notes) {
    for (const linkedTitle of extractWikiLinks(note.textContent)) {
      const normalizedTitle = normalizeNoteTitle(linkedTitle);
      if (!normalizedTitle || existingTitles.has(`${note.subjectId}:${normalizedTitle}`)) continue;
      const key = `${note.subjectId}:${normalizedTitle}`;
      const current = gaps.get(key) ?? {
        title: linkedTitle.trim(),
        normalizedTitle,
        subjectId: note.subjectId,
        referenceCount: 0,
        sourceNoteIds: [],
      };
      current.referenceCount += 1;
      if (!current.sourceNoteIds.includes(note.id)) current.sourceNoteIds.push(note.id);
      gaps.set(key, current);
    }
  }

  return [...gaps.values()].sort((left, right) =>
    right.referenceCount - left.referenceCount || left.title.localeCompare(right.title, "pt-BR"),
  );
}
