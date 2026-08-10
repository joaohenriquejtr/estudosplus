import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Eraser, Send, UserRound } from "lucide-react";
import { toast } from "sonner";

import { sendSocraticChatMessage } from "@/lib/api/ai.functions";
import type { SocraticChatMessage } from "@/lib/ai/llm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

const MAX_MESSAGES = 30;

type SocraticChatSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  title: string;
  content: string;
};

function isChatHistory(value: unknown): value is SocraticChatMessage[] {
  return Array.isArray(value) && value.length <= MAX_MESSAGES && value.every((entry) => (
    entry
    && typeof entry === "object"
    && ((entry as SocraticChatMessage).role === "user" || (entry as SocraticChatMessage).role === "assistant")
    && typeof (entry as SocraticChatMessage).content === "string"
    && (entry as SocraticChatMessage).content.trim().length > 0
  ));
}

export function SocraticChatSheet({ open, onOpenChange, noteId, title, content }: SocraticChatSheetProps) {
  const [messages, setMessages] = useState<SocraticChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const storageKey = `socratic_chat_${noteId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) as unknown : [];
      setMessages(isChatHistory(parsed) ? parsed : []);
    } catch {
      setMessages([]);
    }
    setLoadedStorageKey(storageKey);
    setDraft("");
  }, [storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // The conversation remains usable if storage is unavailable.
    }
  }, [loadedStorageKey, messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const result = await sendSocraticChatMessage({
        data: { title, content, history: messages, message },
      });
      return { question: message, answer: result.message };
    },
    onSuccess: ({ question, answer }) => {
      setMessages((current) => [...current, { role: "user", content: question }, { role: "assistant", content: answer }]);
      setDraft("");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível continuar a conversa."),
  });

  const limitReached = messages.length > MAX_MESSAGES - 2;
  const submit = () => {
    const message = draft.trim();
    if (!message || sendMessage.isPending || limitReached) return;
    sendMessage.mutate(message);
  };

  const clearConversation = () => {
    setMessages([]);
    setDraft("");
    try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-dvh w-full flex-col gap-0 border-border bg-card p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2"><Bot className="size-5 text-primary" />Modo Socrático</SheetTitle>
          <SheetDescription>Vamos pensar juntos sobre {title}.</SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex gap-2.5">
              <div className="mt-0.5 rounded-full bg-primary/15 p-1.5 text-primary"><Bot className="size-4" /></div>
              <p className="max-w-[85%] rounded-lg rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed">Sobre o que você quer refletir hoje em relação a {title}?</p>
            </div>
          )}
          {messages.map((entry, index) => (
            <div key={`${entry.role}-${index}-${entry.content.slice(0, 20)}`} className={`flex gap-2.5 ${entry.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`mt-0.5 rounded-full p-1.5 ${entry.role === "user" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}>
                {entry.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4" />}
              </div>
              <p className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${entry.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted"}`}>{entry.content}</p>
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex gap-2.5"><div className="mt-0.5 rounded-full bg-primary/15 p-1.5 text-primary"><Bot className="size-4" /></div><p className="rounded-lg rounded-tl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">Pensando em uma pergunta…</p></div>
          )}
        </div>

        <div className="border-t border-border p-3">
          {limitReached && <p className="mb-2 text-xs text-muted-foreground">Limite de 30 mensagens atingido. Limpe a conversa para começar outra.</p>}
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Digite sua resposta…"
              rows={2}
              maxLength={2_000}
              disabled={limitReached || sendMessage.isPending}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              className="min-h-10 resize-none"
            />
            <Button size="icon" onClick={submit} disabled={!draft.trim() || limitReached || sendMessage.isPending} aria-label="Enviar mensagem"><Send className="size-4" /></Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2 text-muted-foreground" onClick={clearConversation} disabled={messages.length === 0}><Eraser className="mr-1.5 size-3.5" />Limpar conversa</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
