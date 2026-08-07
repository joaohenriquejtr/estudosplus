import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/useConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Upload, Trash2, Plus, Pencil, Link2, X, PanelLeft, FolderPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import { extractWikiLinks, normalizeNoteTitle, type WikiNote } from "@/lib/note-links";
import { VaultTree, NoteIcon, noteLabel, type VaultFolder, type VaultNote } from "@/components/vault/VaultTree";
import { NoteView, CATEGORIES } from "@/components/vault/NoteView";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/subjects/$id")({
  head: () => ({
    meta: [
      { title: "Matéria — Estudo+" },
      { name: "description", content: "Organize suas notas em pastas, abra várias notas em abas e conecte conteúdos como no Obsidian." },
      { property: "og:title", content: "Matéria — Estudo+" },
      { property: "og:description", content: "Pastas, notas e abas abertas para estudar com fluxo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { note?: string } => (
    typeof search.note === "string" ? { note: search.note } : {}
  ),
  component: SubjectVault,
});

const safeStorageFileName = (fileName: string) => {
  const lastDot = fileName.lastIndexOf(".");
  const rawBase = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const rawExt = lastDot > 0 ? fileName.slice(lastDot + 1) : "arquivo";
  const base = rawBase
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "material";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "bin";
  return `${base}.${ext}`;
};

function SubjectVault() {
  const { confirm: confirmAction, confirmDialog } = useConfirm();
  const { id } = Route.useParams();
  const { note: noteParam } = Route.useSearch();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const openedParam = useRef<string | null>(null);

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const [newFolderParent, setNewFolderParent] = useState<string | null | undefined>(undefined);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [renameFolder, setRenameFolder] = useState<VaultFolder | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const [newNoteFolder, setNewNoteFolder] = useState<string | null | undefined>(undefined);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState("anotacao");

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectColor, setEditSubjectColor] = useState("");

  const { data: subject } = useQuery({
    queryKey: ["subject", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ["chapters", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("*").eq("subject_id", id).order("position").order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ["cards", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_cards").select("*").eq("subject_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  /* ---------- tabs persistence ---------- */
  const storageKey = `vault-tabs-${id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { tabs?: string[]; active?: string | null };
        setOpenTabs(parsed.tabs ?? []);
        setActiveId(parsed.active ?? parsed.tabs?.[0] ?? null);
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ tabs: openTabs, active: activeId })); } catch { /* ignore */ }
  }, [openTabs, activeId, storageKey]);

  // drop tabs whose notes no longer exist
  useEffect(() => {
    if (loadingCards) return;
    const valid = openTabs.filter((tabId) => cards.some((c) => c.id === tabId));
    if (valid.length !== openTabs.length) {
      setOpenTabs(valid);
      if (activeId && !valid.includes(activeId)) setActiveId(valid[valid.length - 1] ?? null);
    }
  }, [cards, loadingCards]);

  const openNote = (noteId: string) => {
    setOpenTabs((tabs) => (tabs.includes(noteId) ? tabs : [...tabs, noteId]));
    setActiveId(noteId);
    setSidebarOpen(false);
    const card = cards.find((c) => c.id === noteId);
    if (card?.chapter_id) setExpanded((e) => ({ ...e, [card.chapter_id]: true }));
  };

  const closeTab = (noteId: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== noteId);
      if (activeId === noteId) setActiveId(next[next.length - 1] ?? null);
      return next;
    });
  };

  useEffect(() => {
    if (!noteParam || openedParam.current === noteParam) return;
    if (cards.some((c) => c.id === noteParam)) {
      openedParam.current = noteParam;
      openNote(noteParam);
    }
  }, [cards, noteParam]);

  /* ---------- derived ---------- */
  const wikiNotes = useMemo<WikiNote[]>(() => cards
    .filter((c) => c.content_type === "text" && c.title?.trim())
    .map((c) => ({ id: c.id, title: c.title.trim() })), [cards]);

  const activeNote = cards.find((c) => c.id === activeId) ?? null;

  const backlinks = useMemo(() => {
    if (!activeNote?.title) return [];
    const current = normalizeNoteTitle(activeNote.title);
    return cards.filter((c) => c.id !== activeNote.id && extractWikiLinks(c.text_content).some((l) => normalizeNoteTitle(l) === current));
  }, [cards, activeNote]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    if (!q) return null;
    return cards.filter((c) =>
      (c.title ?? "").toLocaleLowerCase("pt-BR").includes(q) ||
      (c.file_name ?? "").toLocaleLowerCase("pt-BR").includes(q) ||
      (c.text_content ?? "").toLocaleLowerCase("pt-BR").includes(q));
  }, [cards, search]);

  /* ---------- mutations ---------- */
  const createFolder = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("chapters").insert({
        user_id: user.id, subject_id: id, title: newFolderTitle.trim(),
        parent_id: newFolderParent ?? null, position: folders.length,
      }).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (folder) => {
      toast.success("Pasta criada");
      qc.invalidateQueries({ queryKey: ["chapters", id] });
      setExpanded((e) => ({ ...e, [folder.id]: true, ...(folder.parent_id ? { [folder.parent_id]: true } : {}) }));
      setNewFolderTitle("");
      setNewFolderParent(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateFolder = useMutation({
    mutationFn: async () => {
      if (!renameFolder) throw new Error("Nenhuma pasta selecionada");
      const { error } = await supabase.from("chapters").update({ title: renameTitle.trim() }).eq("id", renameFolder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta renomeada");
      qc.invalidateQueries({ queryKey: ["chapters", id] });
      setRenameFolder(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pasta excluída");
      qc.invalidateQueries({ queryKey: ["chapters", id] });
      qc.invalidateQueries({ queryKey: ["cards", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createNote = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: newNoteTitle.trim() || "Sem título",
        content_type: "text", text_content: newNoteText, category: newNoteCategory,
        chapter_id: newNoteFolder ?? null,
      }).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (card) => {
      toast.success("Nota criada");
      await qc.invalidateQueries({ queryKey: ["cards", id] });
      setOpenTabs((tabs) => (tabs.includes(card.id) ? tabs : [...tabs, card.id]));
      setActiveId(card.id);
      if (card.chapter_id) setExpanded((e) => ({ ...e, [card.chapter_id]: true }));
      setNewNoteTitle(""); setNewNoteText(""); setNewNoteFolder(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createNoteFromWikiLink = useMutation({
    mutationFn: async (title: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title, content_type: "text",
        text_content: `# ${title}\n`, category: "anotacao",
        chapter_id: activeNote?.chapter_id ?? null,
      }).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (card) => {
      toast.success("Nota criada");
      await qc.invalidateQueries({ queryKey: ["cards", id] });
      setOpenTabs((tabs) => (tabs.includes(card.id) ? tabs : [...tabs, card.id]));
      setActiveId(card.id);
      if (card.chapter_id) setExpanded((e) => ({ ...e, [card.chapter_id]: true }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createLink = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try { new URL(url); } catch { throw new Error("Link inválido"); }
      const lower = url.toLowerCase();
      const kind = lower.includes("youtu") ? "youtube" : (lower.includes("drive.google.com") || lower.includes("docs.google.com")) ? "drive" : "generic";
      const { data, error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: linkTitle.trim() || url, content_type: "link",
        text_content: url, file_mime: kind, category: "material", chapter_id: uploadFolder,
      }).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (card) => {
      toast.success("Link adicionado");
      await qc.invalidateQueries({ queryKey: ["cards", id] });
      setLinkOpen(false); setLinkTitle(""); setLinkUrl("");
      openNote(card.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNote = useMutation({
    mutationFn: async (patch: { id: string; title: string | null; text_content: string | null; category: string; chapter_id: string | null }) => {
      const { id: cardId, ...rest } = patch;
      const { error } = await supabase.from("content_cards").update(rest).eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota salva");
      qc.invalidateQueries({ queryKey: ["cards", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeNote = useMutation({
    mutationFn: async (cardId: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (card?.file_url) await supabase.storage.from("study-materials").remove([card.file_url]);
      const { error } = await supabase.from("content_cards").delete().eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: (_d, cardId) => {
      toast.success("Nota excluída");
      closeTab(cardId);
      qc.invalidateQueries({ queryKey: ["cards", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveNote = useMutation({
    mutationFn: async ({ noteId, folderId }: { noteId: string; folderId: string | null }) => {
      const { error } = await supabase.from("content_cards").update({ chapter_id: folderId }).eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.folderId ? "Nota movida" : "Nota movida para a raiz");
      qc.invalidateQueries({ queryKey: ["cards", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveFolder = useMutation({
    mutationFn: async ({ folderId, parentId }: { folderId: string; parentId: string | null }) => {
      const { error } = await supabase.from("chapters").update({ parent_id: parentId }).eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.parentId ? "Pasta movida" : "Pasta movida para a raiz");
      qc.invalidateQueries({ queryKey: ["chapters", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subjects").update({ name: editSubjectName, color: editSubjectColor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matéria atualizada");
      qc.invalidateQueries({ queryKey: ["subject", id] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
      setEditSubjectOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const path = `${user.id}/${id}/${Date.now()}-${safeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("study-materials").upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: file.name, content_type: "file",
        file_url: path, file_name: file.name, file_mime: file.type,
        category: "material", chapter_id: uploadFolder,
      }).select().single();
      if (error) throw error;
      toast.success("Arquivo enviado");
      await qc.invalidateQueries({ queryKey: ["cards", id] });
      openNote((data as any).id);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const treeNotes: VaultNote[] = cards.map((c) => ({
    id: c.id, title: c.title, chapter_id: c.chapter_id, content_type: c.content_type, file_mime: c.file_mime, file_name: c.file_name,
  }));

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border p-2">
        <Button size="sm" variant="secondary" className="flex-1 gap-1.5" onClick={() => { setNewNoteFolder(null); setNewNoteTitle(""); setNewNoteText(""); }}>
          <Plus className="size-4" />Nota
        </Button>
        <Button size="sm" variant="ghost" aria-label="Nova pasta na raiz" title="Nova pasta" onClick={() => setNewFolderParent(null)}><FolderPlus className="size-4" /></Button>
        <Button size="sm" variant="ghost" aria-label="Adicionar link" title="Adicionar link" onClick={() => { setUploadFolder(null); setLinkOpen(true); }}><Link2 className="size-4" /></Button>
        <Button size="sm" variant="ghost" aria-label="Enviar arquivo" title="Enviar arquivo" disabled={uploading} onClick={() => { setUploadFolder(null); fileRef.current?.click(); }}><Upload className="size-4" /></Button>
      </div>

      {openTabs.length > 0 && (
        <div className="border-b border-border p-2">
          <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Abas abertas</p>
          <div className="max-h-40 space-y-0.5 overflow-auto">
            {openTabs.map((tabId) => {
              const card = cards.find((c) => c.id === tabId);
              if (!card) return null;
              const active = tabId === activeId;
              return (
                <div
                  key={tabId}
                  className={cn(
                    "group flex animate-in items-center gap-1 rounded-md pr-1 fade-in slide-in-from-left-2 duration-200",
                    active ? "bg-primary/15 text-primary" : "hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => { setActiveId(tabId); setSidebarOpen(false); }}
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm transition-colors"
                  >
                    <NoteIcon note={card as VaultNote} className={active ? "text-primary" : "text-muted-foreground"} />
                    <span className="truncate">{noteLabel(card as VaultNote)}</span>
                  </button>
                  {openTabs.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Fechar ${noteLabel(card as VaultNote)}`}
                      onClick={() => closeTab(tabId)}
                      className="rounded p-1 text-muted-foreground transition hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nas notas…" className="h-9 pl-8" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {loadingFolders || loadingCards ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-7 animate-pulse rounded bg-muted/60" />)}</div>
        ) : searchResults ? (
          searchResults.length === 0 ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nada encontrado.</p> : (
            <div className="space-y-0.5">
              {searchResults.map((c) => (
                <button key={c.id} onClick={() => openNote(c.id)} className={cn("flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60", activeId === c.id && "bg-primary/15 text-primary")}>
                  <NoteIcon note={c as VaultNote} className="text-muted-foreground" />
                  <span className="truncate">{noteLabel(c as VaultNote)}</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <VaultTree
            folders={folders as VaultFolder[]}
            notes={treeNotes}
            expanded={expanded}
            activeNoteId={activeId}
            onToggle={(fid) => setExpanded((e) => ({ ...e, [fid]: !e[fid] }))}
            onOpenNote={openNote}
            onNewNote={(fid) => { setNewNoteFolder(fid); setNewNoteTitle(""); setNewNoteText(""); }}
            onNewFolder={(pid) => setNewFolderParent(pid)}
            onRenameFolder={(f) => { setRenameFolder(f); setRenameTitle(f.title); }}
            onDeleteFolder={(f) => { void (async () => { if (await confirmAction({ title: `Excluir "${f.title}"?`, description: "As subpastas serão excluídas e as notas ficarão na raiz." })) removeFolder.mutate(f.id); })(); }}
            onDeleteNote={(n) => { void (async () => { if (await confirmAction({ title: `Excluir "${noteLabel(n)}"?`, description: "Esta ação não pode ser desfeita." })) removeNote.mutate(n.id); })(); }}
            onExpandFolder={(fid) => setExpanded((e) => ({ ...e, [fid]: true }))}
            onMoveNote={(noteId, folderId) => moveNote.mutate({ noteId, folderId })}
            onMoveFolder={(folderId, parentId) => moveFolder.mutate({ folderId, parentId })}
          />
        )}
      </div>
    </div>
  );


  return (
    <div className="mx-auto max-w-7xl">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.rar,audio/*,video/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void doUpload(f); }}
      />

      <div className="mb-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          aria-label={sidebarCollapsed ? "Mostrar pastas" : "Ocultar pastas"}
          title={sidebarCollapsed ? "Mostrar pastas" : "Ocultar pastas"}
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="hidden shrink-0 lg:inline-flex"
        >
          <PanelLeft className="size-4" />
        </Button>
        <Button size="sm" variant="secondary" aria-label="Pastas e notas" title="Pastas e notas" onClick={() => setSidebarOpen(true)} className="shrink-0 lg:hidden">
          <PanelLeft className="size-4" />
        </Button>
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: subject?.color ?? "#8b5cf6" }} />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{subject?.name ?? "Matéria"}</h1>
        <Button size="sm" variant="ghost" aria-label="Editar matéria" title="Editar matéria" onClick={() => { if (subject) { setEditSubjectName(subject.name); setEditSubjectColor(subject.color || "#8b5cf6"); setEditSubjectOpen(true); } }}>
          <Pencil className="size-4" />
        </Button>
        <Link to="/subjects" className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /><span className="hidden sm:inline">Voltar</span>
        </Link>
      </div>

      <div className={cn("grid gap-4", sidebarCollapsed ? "lg:grid-cols-[minmax(0,1fr)]" : "lg:grid-cols-[272px_minmax(0,1fr)]")}>
        <aside className={cn("glass-card max-h-[78vh] overflow-hidden", sidebarCollapsed ? "hidden" : "hidden lg:block")}>{sidebar}</aside>

        <section className="glass-card flex min-h-[70vh] flex-col overflow-hidden">



          {activeNote ? (
            <NoteView
              key={activeNote.id}
              note={activeNote}
              folders={folders as VaultFolder[]}
              wikiNotes={wikiNotes}
              backlinks={backlinks}
              onOpenNote={openNote}
              onCreateNote={(title) => createNoteFromWikiLink.mutate(title)}
              saving={updateNote.isPending}
              onSave={(patch) => updateNote.mutate({ id: activeNote.id, ...patch })}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="font-medium">Sua área de estudos desta matéria</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Crie pastas e notas na barra lateral. Abra várias notas em abas e conecte-as com <code className="text-primary">[[nome da nota]]</code>.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setSidebarOpen(true)}><PanelLeft className="mr-1.5 size-4" />Abrir pastas</Button>
                <Button size="sm" onClick={() => { setNewNoteFolder(null); setNewNoteTitle(""); setNewNoteText(""); }}><Plus className="mr-1.5 size-4" />Nova nota</Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* mobile sidebar — painel deslizante */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar pastas"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 animate-in bg-background/70 backdrop-blur-sm fade-in duration-200"
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs animate-in flex-col border-r border-border bg-card shadow-2xl slide-in-from-left duration-300">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium">Pastas e notas</span>
              <button type="button" aria-label="Fechar" onClick={() => setSidebarOpen(false)} className="rounded p-1 text-muted-foreground transition hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{sidebar}</div>
          </div>
        </div>
      )}


      {/* new folder */}
      <Dialog open={newFolderParent !== undefined} onOpenChange={(o) => { if (!o) { setNewFolderParent(undefined); setNewFolderTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
            <DialogDescription>
              {newFolderParent ? `Dentro de "${(folders as VaultFolder[]).find((f) => f.id === newFolderParent)?.title ?? ""}"` : "Na raiz da matéria"}
            </DialogDescription>
          </DialogHeader>
          <Input autoFocus value={newFolderTitle} onChange={(e) => setNewFolderTitle(e.target.value)} placeholder="Ex.: Aulas, Atividades, Resumos" />
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setNewFolderParent(undefined); setNewFolderTitle(""); }}>Cancelar</Button>
            <Button onClick={() => createFolder.mutate()} disabled={!newFolderTitle.trim() || createFolder.isPending}>Criar pasta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* rename folder */}
      <Dialog open={!!renameFolder} onOpenChange={(o) => { if (!o) setRenameFolder(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear pasta</DialogTitle></DialogHeader>
          <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameFolder(null)}>Cancelar</Button>
            <Button onClick={() => updateFolder.mutate()} disabled={!renameTitle.trim() || updateFolder.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* new note */}
      <Dialog open={newNoteFolder !== undefined} onOpenChange={(o) => { if (!o) setNewNoteFolder(undefined); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova nota</DialogTitle>
            <DialogDescription>
              {newNoteFolder ? `Dentro de "${(folders as VaultFolder[]).find((f) => f.id === newNoteFolder)?.title ?? ""}"` : "Na raiz da matéria"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Título</Label><Input autoFocus value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)} placeholder="Aula 3 — Proteínas" /></div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={newNoteCategory} onValueChange={setNewNoteCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo (Markdown)</Label>
              <Textarea value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} rows={8} className="font-mono text-sm" placeholder={"# Título\n- ponto importante\n[[outra nota]]"} />
            </div>
            {newNoteText.trim() && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">Pré-visualização</p>
                <Markdown compact>{newNoteText}</Markdown>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNewNoteFolder(undefined)}>Cancelar</Button>
            <Button onClick={() => createNote.mutate()} disabled={createNote.isPending || (!newNoteTitle.trim() && !newNoteText.trim())}>Criar nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* link */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar link</DialogTitle>
            <DialogDescription>YouTube, Google Drive, artigos ou qualquer página.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Título (opcional)</Label><Input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Videoaula sobre proteínas" /></div>
            <div className="space-y-2"><Label>URL</Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://youtube.com/..." /></div>
            <div className="space-y-2">
              <Label>Pasta</Label>
              <Select value={uploadFolder ?? "root"} onValueChange={(v) => setUploadFolder(v === "root" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Raiz</SelectItem>
                  {(folders as VaultFolder[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button onClick={() => createLink.mutate()} disabled={!linkUrl.trim() || createLink.isPending}>Salvar link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit subject */}
      <Dialog open={editSubjectOpen} onOpenChange={setEditSubjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar matéria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={editSubjectName} onChange={(e) => setEditSubjectName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Cor</Label><Input type="color" value={editSubjectColor} onChange={(e) => setEditSubjectColor(e.target.value)} className="h-10 w-20 p-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditSubjectOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateSubject.mutate()} disabled={!editSubjectName || updateSubject.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </div>
  );
}
