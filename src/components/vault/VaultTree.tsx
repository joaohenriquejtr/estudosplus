import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Link2, FileType2, Image as ImageIcon, FileDown, Plus, Pencil, Trash2, FolderPlus } from "lucide-react";
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
}

export function VaultTree(props: VaultTreeProps) {
  const rootNotes = props.notes.filter((n) => !n.chapter_id);
  return (
    <div className="space-y-0.5">
      {props.folders.filter((f) => !f.parent_id).map((folder) => (
        <FolderRow key={folder.id} folder={folder} depth={0} {...props} />
      ))}
      {rootNotes.map((note) => (
        <NoteRow key={note.id} note={note} depth={0} {...props} />
      ))}
      {props.folders.length === 0 && rootNotes.length === 0 && (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          Crie uma pasta ou uma nota para começar.
        </p>
      )}
    </div>
  );
}

function FolderRow({ folder, depth, ...p }: VaultTreeProps & { folder: VaultFolder; depth: number }) {
  const open = p.expanded[folder.id] ?? false;
  const children = p.folders.filter((f) => f.parent_id === folder.id);
  const notes = p.notes.filter((n) => n.chapter_id === folder.id);
  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-md pr-1 hover:bg-muted/60"
        style={{ paddingLeft: depth * 12 }}
      >
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
            <p className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 12 + 22 }}>Pasta vazia</p>
          )}
        </div>
      )}
    </div>
  );
}

function NoteRow({ note, depth, ...p }: VaultTreeProps & { note: VaultNote; depth: number }) {
  const active = p.activeNoteId === note.id;
  return (
    <div
      className={cn("group flex items-center gap-1 rounded-md pr-1", active ? "bg-primary/15" : "hover:bg-muted/60")}
      style={{ paddingLeft: depth * 12 + 18 }}
    >
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
