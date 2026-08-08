import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WikiLinkProps {
  /** Texto dentro dos colchetes. */
  linkText: string;
  /** Se a nota já existe no vault. */
  noteExists: boolean;
  /** Preview (primeiras linhas) da nota existente. */
  preview?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function WikiLink({ linkText, noteExists, preview, onClick, children }: WikiLinkProps) {
  const label = children ?? linkText;

  const trigger = (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onClick?.(); }}
      className={cn(
        "wikilink cursor-pointer text-left",
        noteExists ? "wikilink-existing" : "wikilink-stub",
      )}
    >
      {label}
      {!noteExists && <span aria-hidden className="hidden sm:inline ml-0.5 text-[0.85em]">+</span>}
    </button>
  );

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top" className="hidden max-w-xs whitespace-pre-line sm:block">
          {noteExists
            ? (preview?.trim() ? preview : "Nota vazia")
            : `Criar nota “${linkText}”`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
