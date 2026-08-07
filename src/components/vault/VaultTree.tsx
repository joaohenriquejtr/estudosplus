import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Link2, FileType2, Image as ImageIcon, FileDown, Plus, Pencil, Trash2, FolderPlus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type VaultFolder = { id: string; title: string; parent_id: string | null };
export type VaultNote = {
  id: string;
  title: string | null;
  chapter_id: string | null;
  content_type: string;
  file_mime: string | null;
  file_name: string | null;
};

export const noteLabel = (note: VaultNote) =>
  note.title?.trim() || note.file_name || (note.content_type === "text" ? "Sem título" : "Item");

export function NoteIcon({ note, className }: { note: VaultNote; className?: string }) {
  const cls = cn("size-4 shrink-0", className);
  if (note.content_type === "link") return <Link2 className={cls} />;
  if (note.content_type === "file") {
    if (note.file_mime?.startsWith("image/")) return <ImageIcon className={cls} />;
    if (note.file_mime === "application/pdf") return <FileType2 className={cls} />;
    return <FileDown className={cls} />;
  }
  return <FileText className={cls} />;
}

type DragItem = { kind: "note" | "folder"; id: string; label: string };

interface VaultTreeProps {
  folders: VaultFolder[];
  notes: VaultNote[];
  expanded: Record<string, boolean>;
  activeNoteId: string | null;
  onToggle: (folderId: string) => void;
  onOpenNote: (noteId: string) => void;
  onNewNote: (folderId: string | null) => void;
  onNewFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: VaultFolder) => void;
  onDeleteFolder: (folder: VaultFolder) => void;
  onDeleteNote: (note: VaultNote) => void;
  onMoveNote?: (noteId: string, folderId: string | null) => void;
  onMoveFolder?: (folderId: string, parentId: string | null) => void;
  onExpandFolder?: (folderId: string) => void;
}

type InnerProps = VaultTreeProps & {
  drag: DragItem | null;
  dropTarget: string | null;
  startDrag: (e: React.PointerEvent, item: DragItem) => void;
};

export function VaultTree(props: VaultTreeProps) {
  const rootNotes = props.notes.filter((n) => !n.chapter_id);
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const stateRef = useRef<{ item: DragItem | null; target: string | null; hoverTimer: number | null; hoverId: string | null }>({
    item: null, target: null, hoverTimer: null, hoverId: null,
  });

  const isDescendant = useCallback((folderId: string, maybeChildId: string) => {
    let cur = props.folders.find((f) => f.id === maybeChildId);
    while (cur?.parent_id) {
      if (cur.parent_id === folderId) return true;
      cur = props.folders.find((f) => f.id === cur!.parent_id);
    }
    return false;
  }, [props.folders]);

  const targetFrom = useCallback((x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const host = el?.closest("[data-drop]") as HTMLElement | null;
    const raw = host?.dataset.drop ?? null;
    if (!raw) return null;
    const item = stateRef.current.item;
    if (!item) return null;
    if (raw === "root") return item.kind === "note"
      ? (props.notes.find((n) => n.id === item.id)?.chapter_id === null ? null : "root")
      : (props.folders.find((f) => f.id === item.id)?.parent_id === null ? null : "root");
    if (item.kind === "folder" && (raw === item.id || isDescendant(item.id, raw))) return null;
    if (item.kind === "note" && props.notes.find((n) => n.id === item.id)?.chapter_id === raw) return null;
    if (item.kind === "folder" && props.folders.find((f) => f.id === item.id)?.parent_id === raw) return null;
    return raw;
  }, [props.notes, props.folders, isDescendant]);

  const startDrag = useCallback((e: React.PointerEvent, item: DragItem) => {
    e.preventDefault();
    e.stopPropagation();
    stateRef.current.item = item;
    setDrag(item);
    setGhost({ x: e.clientX, y: e.clientY });

    const onMove = (ev: PointerEvent) => {
      setGhost({ x: ev.clientX, y: ev.clientY });
      const t = targetFrom(ev.clientX, ev.clientY);
      stateRef.current.target = t;
      setDropTarget(t);
      if (t && t !== "root" && t !== stateRef.current.hoverId) {
        stateRef.current.hoverId = t;
        if (stateRef.current.hoverTimer) window.clearTimeout(stateRef.current.hoverTimer);
        stateRef.current.hoverTimer = window.setTimeout(() => {
          if (stateRef.current.target === t) props.onExpandFolder?.(t);
        }, 500);
      }
    };
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (stateRef.current.hoverTimer) window.clearTimeout(stateRef.current.hoverTimer);
      const target = stateRef.current.target;
      const dragged = stateRef.current.item;
      stateRef.current = { item: null, target: null, hoverTimer: null, hoverId: null };
      setDrag(null); setDropTarget(null); setGhost(null);
      if (!commit || !dragged || !target) return;
      const parent = target === "root" ? null : target;
      if (dragged.kind === "note") props.onMoveNote?.(dragged.id, parent);
      else props.onMoveFolder?.(dragged.id, parent);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }, [props, targetFrom]);

  useEffect(() => () => { if (stateRef.current.hoverTimer) window.clearTimeout(stateRef.current.hoverTimer); }, []);

  const inner: InnerProps = { ...props, drag, dropTarget, startDrag };

  return (
    <div
      data-drop="root"
      className={cn(
        "min-h-full space-y-0.5 rounded-md transition-colors",
        drag && "ring-1 ring-dashed ring-border",
        dropTarget === "root" && "bg-primary/10 ring-primary/60",
      )}
    >
      {props.folders.filter((f) => !f.parent_id).map((folder) => (
        <FolderRow key={folder.id} folder={folder} depth={0} {...inner} />
      ))}
      {rootNotes.map((note) => (
        <NoteRow key={note.id} note={note} depth={0} {...inner} />
      ))}
      {props.folders.length === 0 && rootNotes.length === 0 && (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          Crie uma pasta ou uma nota para começar.
        </p>
      )}
      {drag && (
        <p className="px-2 py-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
          Solte numa pasta ou aqui para tirar da pasta
        </p>
      )}
      {drag && ghost && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-1.5 rounded-md border border-primary/50 bg-popover/95 px-2 py-1 text-xs shadow-lg"
          style={{ left: ghost.x + 10, top: ghost.y + 10 }}
        >
          {drag.kind === "folder" ? <Folder className="size-3.5 text-primary" /> : <FileText className="size-3.5 text-primary" />}
          <span className="max-w-40 truncate">{drag.label}</span>
        </div>
      )}
    </div>
  );
}

function DragHandle({ onPointerDown, label }: { onPointerDown: (e: React.PointerEvent) => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={`Arrastar ${label}`}
      title="Arrastar para mover"
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/60 transition hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}

function FolderRow({ folder, depth, ...p }: InnerProps & { folder: VaultFolder; depth: number }) {
  const open = p.expanded[folder.id] ?? false;
  const children = p.folders.filter((f) => f.parent_id === folder.id);
  const notes = p.notes.filter((n) => n.chapter_id === folder.id);
  const isDragging = p.drag?.kind === "folder" && p.drag.id === folder.id;
  const isOver = p.dropTarget === folder.id;
  return (
    <div>
      <div
        data-drop={folder.id}
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 transition-colors",
          isOver ? "bg-primary/15 ring-1 ring-primary/60" : "hover:bg-muted/60",
          isDragging && "opacity-40",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <DragHandle label={folder.title} onPointerDown={(e) => p.startDrag(e, { kind: "folder", id: folder.id, label: folder.title })} />
        <button
          type="button"
          onClick={() => p.onToggle(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
          {open ? <FolderOpen className="size-4 shrink-0 text-primary" /> : <Folder className="size-4 shrink-0 text-primary" />}
          <span className="truncate">{folder.title}</span>
          <span className="ml-auto shrink-0 pl-1 text-[10px] text-muted-foreground">{notes.length || ""}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition md:group-hover:opacity-100 md:focus-within:opacity-100">
          <IconAction label={`Nova nota em ${folder.title}`} onClick={() => p.onNewNote(folder.id)}><Plus className="size-3.5" /></IconAction>
          <IconAction label={`Nova subpasta em ${folder.title}`} onClick={() => p.onNewFolder(folder.id)}><FolderPlus className="size-3.5" /></IconAction>
          <IconAction label={`Renomear ${folder.title}`} onClick={() => p.onRenameFolder(folder)}><Pencil className="size-3.5" /></IconAction>
          <IconAction label={`Excluir ${folder.title}`} destructive onClick={() => p.onDeleteFolder(folder)}><Trash2 className="size-3.5" /></IconAction>
        </div>
      </div>
      {open && (
        <div>
          {children.map((child) => <FolderRow key={child.id} folder={child} depth={depth + 1} {...p} />)}
          {notes.map((note) => <NoteRow key={note.id} note={note} depth={depth + 1} {...p} />)}
          {children.length === 0 && notes.length === 0 && (
            <p data-drop={folder.id} className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 12 + 22 }}>Pasta vazia</p>
          )}
        </div>
      )}
    </div>
  );
}

function NoteRow({ note, depth, ...p }: InnerProps & { note: VaultNote; depth: number }) {
  const active = p.activeNoteId === note.id;
  const isDragging = p.drag?.kind === "note" && p.drag.id === note.id;
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md pr-1 transition-colors",
        active ? "bg-primary/15" : "hover:bg-muted/60",
        isDragging && "opacity-40",
      )}
      style={{ paddingLeft: depth * 12 + 6 }}
    >
      <DragHandle label={noteLabel(note)} onPointerDown={(e) => p.startDrag(e, { kind: "note", id: note.id, label: noteLabel(note) })} />
      <button
        type="button"
        onClick={() => p.onOpenNote(note.id)}
        className={cn("flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm", active ? "text-primary" : "text-foreground/90")}
      >
        <NoteIcon note={note} className={active ? "text-primary" : "text-muted-foreground"} />
        <span className="truncate">{noteLabel(note)}</span>
      </button>
      <div className="shrink-0 md:opacity-0 md:transition md:group-hover:opacity-100 md:focus-within:opacity-100">
        <IconAction label={`Excluir ${noteLabel(note)}`} destructive onClick={() => p.onDeleteNote(note)}><Trash2 className="size-3.5" /></IconAction>
      </div>
    </div>
  );
}

function IconAction({ label, onClick, children, destructive }: { label: string; onClick: () => void; children: React.ReactNode; destructive?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("rounded p-1 text-muted-foreground transition", destructive ? "hover:text-destructive" : "hover:text-primary")}
    >
      {children}
    </button>
  );
}
