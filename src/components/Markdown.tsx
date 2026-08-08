import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { WikiLink } from "@/components/WikiLink";
import { findWikiNote, toMarkdownWithWikiLinks, type WikiNote } from "@/lib/note-links";

interface MarkdownProps {
  children: string;
  className?: string;
  /** Compact mode for card previews (smaller headings, tighter spacing). */
  compact?: boolean;
  /** Notes available for [[internal links]]. */
  wikiNotes?: WikiNote[];
  onWikiLinkClick?: (note: WikiNote) => void;
  /** Called when clicking a [[link]] that has no matching note yet. */
  onWikiLinkCreate?: (title: string) => void;
}

export function Markdown({ children, className, compact = false, wikiNotes = [], onWikiLinkClick, onWikiLinkCreate }: MarkdownProps) {
  return (
    <div
      className={cn(
        "markdown-body text-foreground",
        compact ? "text-sm leading-relaxed" : "text-base leading-relaxed",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url.startsWith("note:") ? url : defaultUrlTransform(url)}
        components={{
          a: ({ href, children: linkChildren, ...props }) => {
            if (href?.startsWith("note:")) {
              const title = decodeURIComponent(href.slice("note:".length));
              const note = findWikiNote(wikiNotes, title);
              return (
                <WikiLink
                  linkText={title}
                  noteExists={!!note}
                  preview={note?.preview}
                  onClick={note ? () => onWikiLinkClick?.(note) : onWikiLinkCreate ? () => onWikiLinkCreate(title) : undefined}
                >
                  {linkChildren}
                </WikiLink>
              );
            }
            return <a {...props} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80" />;
          },
        }}

      
      >
        {toMarkdownWithWikiLinks(children)}
      </ReactMarkdown>
    </div>
  );
}
