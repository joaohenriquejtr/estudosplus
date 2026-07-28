import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Network, BookOpen, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { extractWikiLinks, findWikiNote, type WikiNote } from "@/lib/note-links";

export const Route = createFileRoute("/_authenticated/graph")({
  head: () => ({ meta: [{ title: "Grafo de notas — Estudo+" }] }),
  component: GraphPage,
});

type GraphNote = WikiNote & {
  subject_id: string;
  subjectName: string;
  subjectColor: string;
  text: string;
};

const SIZE = 720;
const CENTER = SIZE / 2;

function GraphPage() {
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["graph-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_cards")
        .select("id, title, text_content, subject_id, subjects(name,color)")
        .eq("content_type", "text")
        .not("title", "is", null)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const notes = useMemo<GraphNote[]>(() => cards
    .filter((card: any) => card.title?.trim())
    .map((card: any) => ({
      id: card.id,
      title: card.title.trim(),
      text: card.text_content ?? "",
      subject_id: card.subject_id,
      subjectName: card.subjects?.name ?? "Sem matéria",
      subjectColor: card.subjects?.color ?? "#8b5cf6",
    })), [cards]);

  const subjects = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; color: string }>();
    notes.forEach((note) => unique.set(note.subject_id, { id: note.subject_id, name: note.subjectName, color: note.subjectColor }));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [notes]);

  const visibleNotes = useMemo(() => subjectFilter === "all" ? notes : notes.filter((note) => note.subject_id === subjectFilter), [notes, subjectFilter]);

  const edges = useMemo(() => visibleNotes.flatMap((source) => {
    const candidates = notes.filter((note) => note.subject_id === source.subject_id);
    return extractWikiLinks(source.text).flatMap((title) => {
      const target = findWikiNote(candidates, title);
      return target && visibleNotes.some((note) => note.id === target.id) ? [{ from: source.id, to: target.id }] : [];
    });
  }), [notes, visibleNotes]);

  const positions = useMemo(() => {
    const radius = Math.max(150, Math.min(270, 90 + visibleNotes.length * 9));
    return new Map(visibleNotes.map((note, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(visibleNotes.length, 1) - Math.PI / 2;
      return [note.id, { x: CENTER + Math.cos(angle) * radius, y: CENTER + Math.sin(angle) * radius }];
    }));
  }, [visibleNotes]);

  const selected = visibleNotes.find((note) => note.id === selectedId) ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="size-11 rounded-xl bg-primary/20 flex items-center justify-center"><Network className="size-5 text-primary" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Grafo de notas</h1>
          <p className="text-sm text-muted-foreground">Veja como as suas notas se conectam dentro de cada matéria.</p>
        </div>
      </header>

      <section className="glass-card p-4 flex flex-wrap gap-2 items-center">
        <button onClick={() => { setSubjectFilter("all"); setSelectedId(null); }} className={`text-xs px-3 py-1.5 rounded-full border ${subjectFilter === "all" ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/40 border-border hover:bg-muted"}`}>Todas as matérias</button>
        {subjects.map((subject) => <button key={subject.id} onClick={() => { setSubjectFilter(subject.id); setSelectedId(null); }} className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${subjectFilter === subject.id ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted/40 border-border hover:bg-muted"}`}><span className="size-2 rounded-full" style={{ background: subject.color }} />{subject.name}</button>)}
      </section>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando grafo…</p> : visibleNotes.length === 0 ? (
        <div className="glass-card p-10 text-center"><BookOpen className="size-7 text-muted-foreground mx-auto mb-3" /><p className="font-medium">Ainda não há notas com título para exibir.</p><p className="text-sm text-muted-foreground mt-1">Crie notas de texto e conecte-as usando <code className="text-primary">[[Nome da nota]]</code>.</p></div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_250px] gap-4">
          <section className="glass-card overflow-hidden bg-gradient-to-br from-background to-primary/5">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full min-h-[460px] max-h-[70vh]" role="img" aria-label="Grafo de conexões entre notas">
              <defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeOpacity=".05" /></pattern></defs>
              <rect width={SIZE} height={SIZE} fill="url(#grid)" />
              {edges.map((edge, index) => {
                const from = positions.get(edge.from); const to = positions.get(edge.to);
                return from && to ? <line key={`${edge.from}-${edge.to}-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeOpacity=".28" strokeWidth="2" /> : null;
              })}
              {visibleNotes.map((note) => {
                const point = positions.get(note.id)!; const active = selectedId === note.id;
                return <g key={note.id} className="cursor-pointer" onClick={() => setSelectedId(note.id)} onDoubleClick={() => navigate({ to: "/subjects/$id", params: { id: note.subject_id }, search: { note: note.id } })}>
                  <title>{note.title} — {note.subjectName}. Dê dois cliques para abrir.</title>
                  <circle cx={point.x} cy={point.y} r={active ? 25 : 20} fill={note.subjectColor} fillOpacity={active ? ".95" : ".78"} stroke="white" strokeOpacity=".8" strokeWidth={active ? 3 : 1.5} />
                  <text x={point.x} y={point.y + 37} textAnchor="middle" className="fill-foreground text-[13px] font-medium pointer-events-none">{note.title.length > 22 ? `${note.title.slice(0, 21)}…` : note.title}</text>
                </g>;
              })}
            </svg>
          </section>
          <aside className="glass-card p-5 h-fit">
            {selected ? <>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full" style={{ background: selected.subjectColor }} />{selected.subjectName}</span>
              <h2 className="font-semibold mt-2 break-words">{selected.title}</h2>
              <p className="text-xs text-muted-foreground mt-2">{extractWikiLinks(selected.text).length} conexão(ões) de saída</p>
              <Link to="/subjects/$id" params={{ id: selected.subject_id }} className="mt-4 inline-flex text-sm text-primary hover:underline">Abrir matéria →</Link>
            </> : <>
              <Link2 className="size-5 text-primary mb-3" /><h2 className="font-medium">Explore suas conexões</h2><p className="text-sm text-muted-foreground mt-1">Clique em um nó para ver a nota e sua matéria.</p>
              <p className="text-xs text-muted-foreground mt-5">{visibleNotes.length} nota(s) · {edges.length} conexão(ões)</p>
            </>}
          </aside>
        </div>
      )}
    </div>
  );
}
