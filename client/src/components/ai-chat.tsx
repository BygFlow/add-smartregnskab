import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, X, Send, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
};

const WELCOME: ChatMessage = {
  role: "assistant",
  text: "Hej! Jeg er din AI-assistent. Spørg mig om fakturaer, kunder, opgaver, ansatte eller tilbud.",
};

/**
 * Global flydende AI-chat-assistent. Tilgængelig på alle sider for
 * authenticated users. ALT tekst på dansk.
 *
 * Backend: POST /api/ai/assist med body { contextType: "chat", prompt }.
 * Respons: { insights: string[], ... } — hver insight vises som separat besked.
 */
export function AiChatAssistant() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Vis velkomstbesked ved første åbning.
  React.useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([WELCOME]);
    }
  }, [open, messages.length]);

  const mutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest("POST", "/api/ai/assist", {
        contextType: "chat",
        prompt,
      });
      return res.json();
    },
    onSuccess: (data: { insights?: string[] }) => {
      const insights = Array.isArray(data?.insights) ? data.insights : [];
      if (insights.length > 0) {
        setMessages((prev) => [
          ...prev,
          ...insights.map<ChatMessage>((text) => ({ role: "assistant", text })),
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Jeg kunne ikke finde noget at sige om det. Prøv at spørge om fakturaer, kunder, opgaver, ansatte eller tilbud." },
        ]);
      }
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Noget gik galt. Prøv igen senere.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: message, isError: true },
      ]);
    },
  });

  // Auto-scroll til bunden efter ny besked eller loading.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, mutation.isPending]);

  const handleSend = () => {
    const prompt = input.trim();
    if (!prompt || mutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setInput("");
    mutation.mutate(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Flydende knap nederst til højre */}
      <Button
        data-testid="button-ai-chat-open"
        onClick={() => setOpen((v) => !v)}
        size="icon"
        className="fixed bottom-28 right-4 md:bottom-6 md:right-6 z-50 hidden md:flex h-11 w-11 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        aria-label={open ? "Luk AI-assistent" : "Åbn AI-assistent"}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </Button>

      {/* Chat-panel */}
      {open && (
        <Card
          data-testid="panel-ai-chat"
          className="fixed bottom-36 right-4 md:bottom-24 md:right-6 z-50 flex w-[min(380px,calc(100vw-2rem))] max-h-[500px] flex-col overflow-hidden p-0 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-card-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold leading-tight">AI-assistent</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Luk AI-assistent"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Chat-område */}
          <ScrollArea className="flex-1 min-h-0" data-testid="scroll-ai-chat">
            <div ref={scrollRef} className="flex flex-col gap-3 p-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  data-testid={`text-ai-chat-message-${i}`}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-md px-3 py-2 text-sm",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : m.isError
                        ? "mr-auto bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "mr-auto bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </div>
              ))}

              {/* Loading state */}
              {mutation.isPending && (
                <div className="mr-auto flex w-[85%] flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input felt + send-knap */}
          <div className="flex items-center gap-2 border-t border-card-border bg-card p-3">
            <Input
              data-testid="input-ai-chat"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Skriv dit spørgsmål…"
              disabled={mutation.isPending}
              className="flex-1"
            />
            <Button
              data-testid="button-ai-chat-send"
              onClick={handleSend}
              disabled={!input.trim() || mutation.isPending}
              size="icon"
              aria-label="Send besked"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
