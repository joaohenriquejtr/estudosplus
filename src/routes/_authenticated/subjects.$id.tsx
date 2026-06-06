import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Upload, Type as TypeIcon, ClipboardPaste, FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/subjects/$id")({
  head: () => ({ meta: [{ title: "Matéria — Estudo+" }] }),
  component: SubjectDetail,
});

function SubjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: subject } = useQuery({
    queryKey: ["subject", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").eq("id", id).single();
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

  const addText = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: title || null, content_type: "text", text_content: text,
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

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("study-materials").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("content_cards").insert({
        user_id: user.id, subject_id: id, title: title || file.name, content_type: "file",
        file_url: path, file_name: file.name, file_mime: file.type,
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

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("study-materials").createSignedUrl(path, 600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/subjects" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground mb-4">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <div className="size-12 rounded-xl flex items-center justify-center" style={{ background: `${subject?.color}33` }}>
          <FileText className="size-6" style={{ color: subject?.color }} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{subject?.name}</h1>
          <p className="text-sm text-muted-foreground">{cards.length} conteúdo(s)</p>
        </div>
      </div>

      <div className="glass-card p-5 mb-8">
        <h2 className="font-medium mb-4">Adicionar conteúdo</h2>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Título (opcional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumo da aula 3..." /></div>
          <Tabs defaultValue="type">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="type"><TypeIcon className="size-4 mr-2" />Digitar</TabsTrigger>
              <TabsTrigger value="paste"><ClipboardPaste className="size-4 mr-2" />Colar</TabsTrigger>
              <TabsTrigger value="upload"><Upload className="size-4 mr-2" />Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="type" className="space-y-3 pt-3">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva suas anotações..." rows={6} />
              <Button onClick={() => addText.mutate()} disabled={!text || addText.isPending}>Salvar texto</Button>
            </TabsContent>
            <TabsContent value="paste" className="space-y-3 pt-3">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole o conteúdo aqui (Ctrl+V)..." rows={6} />
              <Button onClick={() => addText.mutate()} disabled={!text || addText.isPending}>Salvar conteúdo</Button>
            </TabsContent>
            <TabsContent value="upload" className="space-y-3 pt-3">
              <Input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} disabled={uploading} />
              <p className="text-xs text-muted-foreground">Aceita imagens e PDFs.</p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <h2 className="font-medium mb-3">Conteúdos</h2>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground glass-card p-8 text-center">Nada por aqui ainda.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map((c: any) => (
            <div key={c.id} className="glass-card p-4 group relative">
              <div className="flex items-start gap-2 mb-2">
                {c.content_type === "file" ? <FileDown className="size-4 text-primary mt-1 shrink-0" /> : <FileText className="size-4 text-primary mt-1 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.title ?? (c.content_type === "file" ? c.file_name : "Anotação")}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
                <button onClick={() => { if (confirm("Remover?")) remove.mutate(c.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {c.content_type === "text" ? (
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{c.text_content}</p>
              ) : (
                <button onClick={() => openFile(c.file_url)} className="text-xs text-primary hover:underline">Abrir arquivo</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
