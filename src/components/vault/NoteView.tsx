import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/Markdown";
import { ExternalLink, Eye, Link2, Pencil, Save, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { normalizeNoteTitle, type WikiNote } from "@/lib/note-links";
import type { VaultFolder } from "./VaultTree";

export const CATEGORIES = [
  { value: "anotacao", label: "Anotação" },
  { value: "resumo", label: "Resumo" },
  { value: "exercicio", label: "Exercício" },
  { value: "material", label: "Material" },
];

interface NoteViewProps {
  note: any;
  folders: VaultFolder[];
  wikiNotes: WikiNote[];
  backlinks: any[];
  onOpenNote: (noteId: string) => void;
  onSave: (patch: { title: string | null; text_content: string | null; category: string; chapter_id: string | null }) => void;
  saving: boolean;
}

export function NoteView({ note, folders, wikiNotes, backlinks, onOpenNote, onSave, saving }: NoteViewProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("anotacao");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(false);
    setTitle(note.title ?? "");
    setText(note.text_content ?? "");
    setCategory(note.category ?? "anotacao");
    setFolderId(note.chapter_id ?? null);
  }, [note.id]);

  useEffect(() => {
    let cancelled = false;
    setViewUrl(null);
    if (note.content_type === "file" && note.file_url) {
      supabase.storage.from("study-materials").createSignedUrl(note.file_url, 600).then(({ data, error }) => {
        if (cancelled) return;
        if (error) { toast.error(error.message); return; }
        setViewUrl(data.signedUrl);
      });
    }
    return () => { cancelled = true; };
  }, [note.id, note.file_url, note.content_type]);

  const suggestions = useMemo(() => {
    const opening = text.lastIndexOf("[[");
    if (!editing || opening < 0 || text.indexOf("]]", opening) >= 0) return [];
    const query = normalizeNoteTitle(text.slice(opening + 2));
    return wikiNotes.filter((n) => n.id !== note.id && normalizeNoteTitle(n.title).includes(query)).slice(0, 5);
  }, [text, editing, wikiNotes, note.id]);

  const insertWikiLink = (target: WikiNote) => {
    const opening = text.lastIndexOf("[[");
    if (opening < 0) return;
    setText(`${text.slice(0, opening)}[[${target.title}]]`);
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const embedUrl = () => {
    const url: string = note.text_content ?? "";
    if (note.file_mime === "youtube") {
      const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
      return m ? `https://www.youtube.com/embed/${m[1]}` : null;
    }
    if (note.file_mime === "drive") {
      const m = url.match(/\/d\/([\w-]+)/);
      return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
    }
    return null;
  };

  const folderPath = (fid: string | null): string => {
    if (!fid) return "Raiz";
    const folder = folders.find((f) => f.id === fid);
    if (!folder) return "Raiz";
    return folder.parent_id ? `${folderPath(folder.parent_id)} / ${folder.title}` : folder.title;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-start gap-2 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{note.title?.trim() || note.file_name || "Sem título"}</h1>
          <p className="text-xs text-muted-foreground">
            {folderPath(note.chapter_id)} · {CATEGORIES.find((c) => c.value === note.category)?.label ?? note.category} ·{" "}
            {format(new Date(note.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        {note.content_type === "text" && (
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}><X className="mr-1.5 size-4" />Cancelar</Button>
              <Button size="sm" disabled={saving} onClick={() => { onSave({ title: title.trim() || null, text_content: text, category, chapter_id: folderId }); setEditing(false); }}>
                <Save className="mr-1.5 size-4" />Salvar
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil className="mr-1.5 size-4" />Editar</Button>
          )
        )}
        {note.content_type !== "text" && (
          <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? <><Eye className="mr-1.5 size-4" />Visualizar</> : <><Pencil className="mr-1.5 size-4" />Detalhes</>}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        {editing ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da nota" /></div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Pasta</Label>
                <Select value={folderId ?? "root"} onValueChange={(v) => setFolderId(v === "root" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Raiz</SelectItem>
                    {folders.map((f) => <SelectItem key={f.id} value={f.id}>{folderPath(f.id)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {note.content_type === "text" ? (
              <>
                <Textarea ref={textRef} value={text} onChange={(e) => setText(e.target.value)} rows={16} className="font-mono text-sm"
                  placeholder={"# Título\n**negrito** *itálico*\n- [ ] tarefa\n[[outra nota]]"} />
                {suggestions.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-background p-2 shadow-sm">
                    <p className="px-2 pb-1 text-xs text-muted-foreground">Vincular nota</p>
                    {suggestions.map((s) => (
                      <button key={s.id} type="button" onClick={() => insertWikiLink(s)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
                        <span className="text-primary">[[</span>{s.title}<span className="text-primary">]]</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Markdown suportado. Use <code className="text-primary">[[nome da nota]]</code> para conectar notas.</p>
              </>
            ) : (
              <div className="flex justify-end">
                <Button size="sm" disabled={saving} onClick={() => { onSave({ title: title.trim() || null, text_content: note.text_content, category, chapter_id: folderId }); setEditing(false); }}>
                  <Save className="mr-1.5 size-4" />Salvar
                </Button>
              </div>
            )}
          </div>
        ) : note.content_type === "text" ? (
          note.text_content?.trim()
            ? <Markdown wikiNotes={wikiNotes} onWikiLinkClick={(n) => onOpenNote(n.id)}>{note.text_content}</Markdown>
            : <p className="text-sm text-muted-foreground">Nota vazia. Clique em “Editar” para escrever.</p>
        ) : note.content_type === "file" ? (
          !viewUrl ? <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
            : note.file_mime?.startsWith("image/") ? <img src={viewUrl} alt={note.file_name ?? ""} className="h-auto w-full rounded-lg" />
            : note.file_mime === "application/pdf" ? <iframe src={viewUrl} title={note.file_name ?? "PDF"} className="h-[70vh] w-full rounded-lg border border-border" />
            : (
              <div className="space-y-3 py-12 text-center">
                <p className="text-sm text-muted-foreground">Pré-visualização não disponível para este tipo.</p>
                <Button asChild variant="secondary"><a href={viewUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4" />Abrir em nova aba</a></Button>
              </div>
            )
        ) : (
          (() => {
            const embed = embedUrl();
            return embed ? (
              <iframe src={embed} title={note.title ?? "Link"} className="h-[70vh] w-full rounded-lg border border-border" allow="autoplay; fullscreen" />
            ) : (
              <div className="space-y-3 py-12 text-center">
                <p className="break-all text-sm text-muted-foreground">{note.text_content}</p>
                <Button asChild variant="secondary"><a href={note.text_content} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4" />Abrir link</a></Button>
              </div>
            );
          })()
        )}
      </div>

      {note.content_type === "text" && note.title && !editing && (
        <div className="border-t border-border px-4 py-3 sm:px-6">
          <h2 className="mb-2 text-sm font-medium">Notas que mencionam esta nota</h2>
          {backlinks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conexão ainda.</p> : (
            <div className="flex flex-wrap gap-2">
              {backlinks.map((b: any) => (
                <Button key={b.id} variant="secondary" size="sm" onClick={() => onOpenNote(b.id)}>
                  <Link2 className="mr-1.5 size-3.5" />{b.title ?? "Anotação"}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
