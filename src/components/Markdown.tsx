import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
  /** Compact mode for card previews (smaller headings, tighter spacing). */
  compact?: boolean;
}

export function Markdown({ children, className, compact = false }: MarkdownProps) {
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
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
