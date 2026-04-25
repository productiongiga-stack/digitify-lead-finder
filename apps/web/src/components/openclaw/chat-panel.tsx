"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useUIStore } from "@/stores/ui-store";
import { usePathname } from "next/navigation";
import {
  Button, Card, CardContent, CardHeader, CardTitle,
  Textarea, Badge, Separator, ScrollArea,
} from "@digitify/ui";
import { X, Send, Bot, User, Sparkles, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function OpenClawPanel() {
  const { openClawOpen, setOpenClawOpen } = useUIStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Extract leadId / campaignId from URL
  const leadIdMatch = pathname.match(/\/leads\/([a-zA-Z0-9-]+)$/);
  const campaignIdMatch = pathname.match(/\/campaigns\/([a-zA-Z0-9-]+)$/);
  const leadId = leadIdMatch?.[1];
  const campaignId = campaignIdMatch?.[1];

  const chatMutation = trpc.openclaw.chat.useMutation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!openClawOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || chatMutation.isPending) return;

    const newMessages: Message[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(newMessages);
    setInput("");

    try {
      const result = await chatMutation.mutateAsync({
        messages: newMessages,
        context: {
          currentPage: pathname,
          leadId,
          campaignId,
        },
      });

      setMessages([...newMessages, { role: "assistant", content: result.response }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Er ging iets mis. Probeer het opnieuw." },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l bg-background shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">OpenClaw</h3>
            <p className="text-xs text-muted-foreground">AI Assistent</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMessages([])}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOpenClawOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Context indicator */}
      {(leadId || campaignId) && (
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground">
            Context: {leadId ? "Lead detail" : "Campagne detail"}
          </span>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">Hallo! Ik ben OpenClaw</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                AI-assistent voor leadanalyse, campagnes en drafts met correcte placeholders.
              </p>
            </div>

            <div className="w-full space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Probeer bijvoorbeeld:</p>
              {[
                "Analyseer deze lead en geef 5 concrete opportuniteiten met impactscore.",
                "Schrijf een eerste outreach mail met placeholders {{senderName}} en {{senderCompany}}.",
                "Maak 3 follow-up varianten voor campagne step 2 zonder agressieve toon.",
                "Geef verbeterpunten voor deze pagina op basis van intentie en conversie.",
                "Stel een korte samenvatting op die ik rechtstreeks in een klantrapport kan plakken.",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="w-full rounded-lg border bg-card p-2.5 text-left text-xs transition-colors hover:bg-accent"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="rounded-xl bg-muted px-3.5 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stel een vraag aan OpenClaw..."
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            disabled={!input.trim() || chatMutation.isPending}
            onClick={handleSend}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          OpenClaw maakt alleen drafts — verstuurt nooit e-mails zonder jouw goedkeuring.
        </p>
      </div>
    </div>
  );
}
