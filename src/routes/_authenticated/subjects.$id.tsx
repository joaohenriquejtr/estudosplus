import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Upload, Type as TypeIcon, ClipboardPaste, FileDown, Trash2, ExternalLink, Plus, BookMarked, Pencil, Link2, Youtube, HardDrive, Image as ImageIcon, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/_authenticated/subjects/$id")({
  head: () => ({ meta: [{ title: "Matéria — Estudo+" }] }),
  component: SubjectDetail,
});

const CATEGORIES = [
  { value: "anotacao", label: "Anotação" },
  { value: "resumo", label: "Resumo" },
  { value: "exercicio", label: "Exercício" },
  { value: "material", label: "Material" },
];

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

function SubjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("anotacao");
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkKind, setLinkKind] = useState<"youtube" | "drive" | "generic">("generic");
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectColor, setEditSubjectColor] = useState("");

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardTitle, setEditCardTitle] = useState("");
  const [editCardText, setEditCardText] = useState("");
  const [editCardCategory, setEditCardCategory] = useState("anotacao");
  const [editCardChapter, setEditCardChapter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setViewUrl(null);
    if (viewing?.content_type === "file" && viewing.file_url) {
      supabase.storage.from("study-materials").createSignedUrl(viewing.file_url, 600).then(({ data, error }) => {
        if (cancelled) return;
        if (error) { toast.error(error.message); return; }
        setViewUrl(data.signedUrl);
      });
    }
    return () => { cancelled = true; };
  }, [viewing]);

  const { data: subject } = useQuery({
    queryKey: ["subject", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("*").eq("subject_id", id).order("position").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_cards").select("*").eq("subject_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredCards = useMemo(() => {
    return cards.filter((c: any) => {
      if (selectedChapter === "all") {
        // show all
      } else if (selectedChapter === "none") {
        if (c.chapter_id) return false;
      } else if (c.chapter_id !== selectedChapter) return false;
      if (filterCategory !== "all" && c.category !== filterCategory) return false;
      return true;
    });
  }, [cards, selectedChapter, filterCategory]);

  const targetChapterId = selectedChapter !== "all" && selectedChapter !== "none" ? selectedChapter : null;

  const createChapter = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("chapters").insert({
        user_id: user.id, subject_id: id, title: newChapterTitle, position: chapters.length,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (c: any) => {
      toast.success("Capítulo criado!");
      qc.invalidateQueries({ queryKey: ["chapters", id] });
      setNewChapterTitle("");
      setNewChapterOpen(false);
      setSelectedChapter(c.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeChapter = useMutation({
    mutationFn: async (chId: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", chId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Capítulo removido");
      qc.invalidateQueries({ queryKey: ["chapters", id] });
      qc.invalidateQueries({ queryKey: ["cards", id] });
      setSelectedChapter("all");
    },
  });

  const updateChapter = useMutation({
    mutationFn: async () => {
      if (!editingChapterId) throw new Error("Nenhum capítulo selecionado");
      const { error } = await supabase.from("chapters").update({ title: editChapterTitle }).eq("id", editingChapterId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Capítulo atualizado!");
      qc.invalidateQueries({ queryKey: ["chapters", id] });
      setEditingChapterId(null);
      setEditChapterTitle("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSubject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subjects").update({ name: editSubjectName, color: editSubjectColor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matéria atualizada!");
      qc.invalidateQueries({ queryKey: ["subject", id] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
      setEditSubjectOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addText = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: title || null, content_type: "text", text_content: text,
        chapter_id: targetChapterId, category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo adicionado!");
      qc.invalidateQueries({ queryKey: ["cards", id] });
      setTitle(""); setText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detectKind = (url: string): "youtube" | "drive" | "generic" => {
    const u = url.toLowerCase();
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
    if (u.includes("drive.google.com") || u.includes("docs.google.com")) return "drive";
    return "generic";
  };

  const addLink = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try { new URL(url); } catch { throw new Error("Link inválido"); }
      const kind = linkKind === "generic" ? detectKind(url) : linkKind;
      const { error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: title || url, content_type: "link",
        text_content: url, file_mime: kind, chapter_id: targetChapterId, category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link adicionado!");
      qc.invalidateQueries({ queryKey: ["cards", id] });
      setTitle(""); setLinkUrl("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (cardId: string) => {
      const card = cards.find((c: any) => c.id === cardId);
      if (card?.file_url) {
        await supabase.storage.from("study-materials").remove([card.file_url]);
      }
      const { error } = await supabase.from("content_cards").delete().eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["cards", id] }); },
  });

  const updateCard = useMutation({
    mutationFn: async () => {
      if (!editingCardId) throw new Error("Nenhum conteúdo selecionado");
      const { error } = await supabase.from("content_cards").update({
        title: editCardTitle || null,
        text_content: editCardText || null,
        category: editCardCategory,
        chapter_id: editCardChapter,
      }).eq("id", editingCardId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo atualizado!");
      qc.invalidateQueries({ queryKey: ["cards", id] });
      setEditingCardId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const path = `${user.id}/${id}/${Date.now()}-${safeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("study-materials").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: title || file.name, content_type: "file",
        file_url: path, file_name: file.name, file_mime: file.type,
        chapter_id: targetChapterId, category,
      });
      if (error) throw error;
      toast.success("Arquivo enviado!");
      qc.invalidateQueries({ queryKey: ["cards", id] });
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const chapterLabel = (chId: string | null) => {
    if (!chId) return "Geral";
    return chapters.find((c: any) => c.id === chId)?.title ?? "Capítulo";
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/subjects" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground mb-4">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <div className="size-12 rounded-xl flex items-center justify-center" style={{ background: `${subject?.color ?? "#8b5cf6"}33` }}>
          <FileText className="size-6" style={{ color: subject?.color ?? "#8b5cf6" }} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{subject?.name}</h1>
          <p className="text-sm text-muted-foreground">{cards.length} conteúdo(s) · {chapters.length} capítulo(s)</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => { if (subject) { setEditSubjectName(subject.name); setEditSubjectColor(subject.color || "#8b5cf6"); setEditSubjectOpen(true); } }}
        ><Pencil className="size-4 mr-2" />Editar matéria</Button>
      </div>

      {/* Chapters bar */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BookMarked className="size-4 text-primary" />
          <h2 className="font-medium">Capítulos</h2>
          <Dialog open={newChapterOpen} onOpenChange={setNewChapterOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="ml-auto gap-1"><Plus className="size-4" />Novo capítulo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo capítulo</DialogTitle>
                <DialogDescription>Organize seus conteúdos por capítulo (ex.: Capítulo 8 — Proteínas).</DialogDescription>
              </DialogHeader>
              <Input value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} placeholder="Capítulo 8 — Proteínas" />
              <DialogFooter>
                <Button onClick={() => createChapter.mutate()} disabled={!newChapterTitle.trim() || createChapter.isPending}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedChapter("all")} className={`text-xs px-3 py-1.5 rounded-full border ${selectedChapter === "all" ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/40 border-border hover:bg-muted"}`}>Todos</button>
          <button onClick={() => setSelectedChapter("none")} className={`text-xs px-3 py-1.5 rounded-full border ${selectedChapter === "none" ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/40 border-border hover:bg-muted"}`}>Sem capítulo</button>
          {chapters.map((c: any) => (
            <div key={c.id} className="group inline-flex items-center">
              <button onClick={() => setSelectedChapter(c.id)} className={`text-xs pl-3 pr-2 py-1.5 rounded-full border inline-flex items-center gap-2 ${selectedChapter === c.id ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/40 border-border hover:bg-muted"}`}>
                {c.title}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setEditingChapterId(c.id); setEditChapterTitle(c.title); }}
                  className="opacity-60 hover:opacity-100 hover:text-primary"
                >
                  <Pencil className="size-3" />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Remover "${c.title}"? Os conteúdos ficarão sem capítulo.`)) removeChapter.mutate(c.id); }}
                  className="opacity-60 hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5 mb-8">
        <h2 className="font-medium mb-1">Adicionar conteúdo</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Vai para: <span className="text-foreground">{chapterLabel(targetChapterId)}</span>
        </p>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Título (opcional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumo da aula 3..." /></div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Tabs defaultValue="type">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="type"><TypeIcon className="size-4 mr-2" />Digitar</TabsTrigger>
              <TabsTrigger value="paste"><ClipboardPaste className="size-4 mr-2" />Colar</TabsTrigger>
              <TabsTrigger value="link"><Link2 className="size-4 mr-2" />Link</TabsTrigger>
              <TabsTrigger value="upload"><Upload className="size-4 mr-2" />Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="type" className="space-y-3 pt-3">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Escreva em Markdown (estilo Obsidian)...\n\n# Título\n**negrito**  *itálico*  ==destaque==\n- lista\n- [ ] tarefa\n> citação\n`código`"} rows={8} className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Suporta Markdown: <code className="text-primary">#</code> títulos, <code className="text-primary">**negrito**</code>, listas, <code className="text-primary">- [ ]</code> checkboxes, tabelas, código, links e imagens.</p>
              <Button onClick={() => addText.mutate()} disabled={!text || addText.isPending}>Salvar texto</Button>
            </TabsContent>
            <TabsContent value="paste" className="space-y-3 pt-3">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole o conteúdo aqui (Ctrl+V)... Markdown suportado." rows={8} className="font-mono text-sm" />
              <Button onClick={() => addText.mutate()} disabled={!text || addText.isPending}>Salvar conteúdo</Button>
            </TabsContent>
            <TabsContent value="link" className="space-y-3 pt-3">
              <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://youtube.com/... ou drive.google.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={linkKind} onValueChange={(v) => setLinkKind(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generic">Detectar / Outro</SelectItem>
                      <SelectItem value="youtube">Vídeo (YouTube)</SelectItem>
                      <SelectItem value="drive">Google Drive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => addLink.mutate()} disabled={!linkUrl.trim() || addLink.isPending}>Salvar link</Button>
              <p className="text-xs text-muted-foreground">Cole links do YouTube, Google Drive, artigos ou qualquer página.</p>
            </TabsContent>
            <TabsContent value="upload" className="space-y-3 pt-3">
              <Input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.rar,audio/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} disabled={uploading} />
              <p className="text-xs text-muted-foreground">Aceita prints, PDFs, documentos (Word, PowerPoint, Excel), áudios e vídeos.</p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-medium">Conteúdos</h2>
        <div className="ml-auto flex gap-1 flex-wrap">
          <button onClick={() => setFilterCategory("all")} className={`text-xs px-2 py-1 rounded-md ${filterCategory === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"}`}>Todos</button>
          {CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setFilterCategory(c.value)} className={`text-xs px-2 py-1 rounded-md ${filterCategory === c.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"}`}>{c.label}</button>
          ))}
        </div>
      </div>
      {filteredCards.length === 0 ? (
        <p className="text-sm text-muted-foreground glass-card p-8 text-center">Nada por aqui ainda.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filteredCards.map((c: any) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setViewing(c)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewing(c); } }}
              className="glass-card p-4 group relative text-left cursor-pointer transition hover:border-primary/40 hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <div className="flex items-start gap-2 mb-2">
                {c.content_type === "link"
                  ? (c.file_mime === "youtube" ? <Youtube className="size-4 text-primary mt-1 shrink-0" /> : c.file_mime === "drive" ? <HardDrive className="size-4 text-primary mt-1 shrink-0" /> : <Link2 className="size-4 text-primary mt-1 shrink-0" />)
                  : c.content_type === "file"
                  ? (c.file_mime?.startsWith("image/") ? <ImageIcon className="size-4 text-primary mt-1 shrink-0" /> : c.file_mime === "application/pdf" ? <FileType2 className="size-4 text-primary mt-1 shrink-0" /> : <FileDown className="size-4 text-primary mt-1 shrink-0" />)
                  : <FileText className="size-4 text-primary mt-1 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.title ?? (c.content_type === "file" ? c.file_name : "Anotação")}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 border">{chapterLabel(c.chapter_id)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{CATEGORIES.find((x) => x.value === c.category)?.label ?? c.category}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCardId(c.id); setEditCardTitle(c.title || ""); setEditCardText(c.text_content || ""); setEditCardCategory(c.category || "anotacao"); setEditCardChapter(c.chapter_id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (confirm("Remover?")) remove.mutate(c.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              {c.content_type === "text" ? (
                <div className="line-clamp-4 text-muted-foreground"><Markdown compact>{c.text_content ?? ""}</Markdown></div>
              ) : c.content_type === "link" ? (
                <p className="text-xs text-primary truncate">{c.text_content}</p>
              ) : (
                <p className="text-xs text-primary">Clique para visualizar</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">
              {viewing?.title ?? (viewing?.content_type === "file" ? viewing?.file_name : "Anotação")}
            </DialogTitle>
            <DialogDescription>
              {viewing && format(new Date(viewing.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1 -mx-6 px-6">
            {viewing?.content_type === "text" ? (
              <Markdown>{viewing.text_content ?? ""}</Markdown>
            ) : viewing?.content_type === "file" ? (
              !viewUrl ? (
                <p className="text-sm text-muted-foreground text-center py-12">Carregando…</p>
              ) : viewing.file_mime?.startsWith("image/") ? (
                <img src={viewUrl} alt={viewing.file_name ?? ""} className="w-full h-auto rounded-lg" />
              ) : viewing.file_mime === "application/pdf" ? (
                <iframe src={viewUrl} title={viewing.file_name ?? "PDF"} className="w-full h-[70vh] rounded-lg border border-border" />
              ) : (
                <div className="text-center py-12 space-y-3">
                  <p className="text-sm text-muted-foreground">Pré-visualização não disponível para este tipo.</p>
                  <Button asChild variant="secondary"><a href={viewUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-2" />Abrir em nova aba</a></Button>
                </div>
              )
            ) : viewing?.content_type === "link" ? (
              (() => {
                const url: string = viewing.text_content ?? "";
                const kind = viewing.file_mime;
                let embed: string | null = null;
                if (kind === "youtube") {
                  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
                  if (m) embed = `https://www.youtube.com/embed/${m[1]}`;
                } else if (kind === "drive") {
                  const m = url.match(/\/d\/([\w-]+)/);
                  if (m) embed = `https://drive.google.com/file/d/${m[1]}/preview`;
                }
                return embed ? (
                  <iframe src={embed} title={viewing.title ?? "Link"} className="w-full h-[70vh] rounded-lg border border-border" allow="autoplay; fullscreen" />
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-sm text-muted-foreground break-all">{url}</p>
                    <Button asChild variant="secondary"><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-2" />Abrir link</a></Button>
                  </div>
                );
              })()
            ) : null}
          </div>
          {viewing?.content_type === "link" && viewing.text_content && (
            <div className="pt-2 border-t border-border flex justify-end">
              <Button asChild variant="ghost" size="sm"><a href={viewing.text_content} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-2" />Abrir em nova aba</a></Button>
            </div>
          )}
          {viewing?.content_type === "file" && viewUrl && (
            <div className="pt-2 border-t border-border flex justify-end">
              <Button asChild variant="ghost" size="sm"><a href={viewUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-2" />Abrir em nova aba</a></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
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

      {/* Edit Chapter Dialog */}
      <Dialog open={!!editingChapterId} onOpenChange={(o) => { if (!o) { setEditingChapterId(null); setEditChapterTitle(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar capítulo</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Título</Label><Input value={editChapterTitle} onChange={(e) => setEditChapterTitle(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setEditingChapterId(null); setEditChapterTitle(""); }}>Cancelar</Button>
            <Button onClick={() => updateChapter.mutate()} disabled={!editChapterTitle.trim() || updateChapter.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={!!editingCardId} onOpenChange={(o) => { if (!o) setEditingCardId(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Editar conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={editCardTitle} onChange={(e) => setEditCardTitle(e.target.value)} placeholder="Título do conteúdo" /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={editCardCategory} onValueChange={setEditCardCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capítulo</Label>
                <Select value={editCardChapter ?? "none"} onValueChange={(v) => setEditCardChapter(v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geral (sem capítulo)</SelectItem>
                    {chapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Texto (Markdown)</Label><Textarea value={editCardText} onChange={(e) => setEditCardText(e.target.value)} placeholder="Conteúdo em Markdown..." rows={8} className="font-mono text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingCardId(null)}>Cancelar</Button>
            <Button onClick={() => updateCard.mutate()} disabled={updateCard.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
