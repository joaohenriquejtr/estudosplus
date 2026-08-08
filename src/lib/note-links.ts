export type WikiNote = {
  id: string;
  title: string;
  /** Primeiras linhas do conteúdo, usadas no tooltip de preview. */
  preview?: string;
};

export const normalizeNoteTitle = (title: string) => title.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

/** Primeiras `lines` linhas não vazias do markdown, sem marcações pesadas. */
export const notePreview = (text: string | null | undefined, lines = 2) => {
  if (!text) return "";
  return text
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s*/, "").replace(/\[\[([^\]\n]+)\]\]/g, "$1").replace(/[*_`>]/g, "").trim())
    .filter(Boolean)
    .slice(0, lines)
    .join("\n");
};


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
