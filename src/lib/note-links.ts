export type WikiNote = {
  id: string;
  title: string;
};

export const normalizeNoteTitle = (title: string) => title.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export const extractWikiLinks = (text: string | null | undefined) => {
  if (!text) return [];
  return [...text.matchAll(/\[\[([^\]\n]+)\]\]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
};

export const findWikiNote = (notes: WikiNote[], title: string) =>
  notes.find((note) => normalizeNoteTitle(note.title) === normalizeNoteTitle(title));

export const toMarkdownWithWikiLinks = (text: string) =>
  text.replace(/\[\[([^\]\n]+)\]\]/g, (_match, rawTitle: string) => {
    const title = rawTitle.trim();
    return title ? `[${title}](note:${encodeURIComponent(title)})` : _match;
  });
