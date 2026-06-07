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
import { resolveOpenClawPageAssist } from "./page-assist-config";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const OPENCLAW_STARTER_PROMPTS = [
  "Analyseer deze lead en geef 5 concrete opportuniteiten met impactscore.",
  "Schrijf een eerste outreach mail met placeholders {{senderName}} en {{senderCompany}}.",
  "Maak 3 follow-up varianten voor campagne step 2 zonder agressieve toon.",
  "Geef verbeterpunten voor deze pagina op basis van intentie en conversie.",
  "Stel een korte samenvatting op die ik rechtstreeks in een klantrapport kan plakken.",
  "Schrijf een korte LinkedIn-connectie met placeholders {{leadName}} en {{companyName}}.",
  "Bedenk 5 onderwerpregels voor een cold email A/B-test met verschillende hooks.",
  "Herschrijf deze mail korter, professioneler en met duidelijke CTA.",
  "Maak een WhatsApp-follow-up die informeel klinkt maar nog steeds professioneel blijft.",
] as const;

export function OpenClawPanel() {
  const openClawOpen = useUIStore((state) => state.openClawOpen);
  const setOpenClawOpen = useUIStore((state) => state.setOpenClawOpen);
  const openClawAssistLaunch = useUIStore((state) => state.openClawAssistLaunch);
  const clearOpenClawAssistLaunch = useUIStore((state) => state.clearOpenClawAssistLaunch);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const pageAssist = resolveOpenClawPageAssist(pathname);
  const starterPrompts = pageAssist?.starterPrompts ?? OPENCLAW_STARTER_PROMPTS;

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

  useEffect(() => {
    if (!openClawAssistLaunch?.seedMessage) return;
    setInput(openClawAssistLaunch.seedMessage);
    clearOpenClawAssistLaunch();
  }, [openClawAssistLaunch, clearOpenClawAssistLaunch]);

  if (!openClawOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || chatMutation.isPending) return;

    const newMessages: Message[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(newMessages);
    setInput("");

    try {
      const assistBookings =
        openClawAssistLaunch?.assistBookings ||
        pageAssist?.assistBookings ||
        pathname.includes("/settings/bookings");

      const result = await chatMutation.mutateAsync({
        messages: newMessages,
        context: {
          currentPage: pathname,
          leadId,
          campaignId,
          assistBookings,
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
    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l bg-background shadow-2xl">
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
      {(leadId || campaignId || pageAssist) && (
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-xs text-muted-foreground">
            Context:{" "}
            {leadId ? "Lead detail" : campaignId ? "Campagne detail" : pageAssist?.title ?? "Pagina"}
          </span>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">Hallo! Ik ben OpenClaw</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {pageAssist
                  ? pageAssist.description
                  : "AI-assistent voor leadanalyse, campagnes en drafts met correcte placeholders."}
              </p>
            </div>

            <div className="w-full space-y-2 text-left">
              <p className="text-center text-xs font-medium text-muted-foreground">Probeer bijvoorbeeld:</p>
              {starterPrompts.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="w-full rounded-xl border border-border/70 bg-card/90 p-2.5 text-left text-xs leading-relaxed transition-colors hover:border-primary/30 hover:bg-accent/60"
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
      <div className="border-t border-border/60 bg-gradient-to-t from-muted/40 via-background to-background px-4 pb-4 pt-3">
        <div className="group/composer overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card/98 to-muted/20 p-1.5 shadow-[0_10px_32px_rgba(15,23,42,0.07)] ring-1 ring-black/[0.03] backdrop-blur-md transition-[border-color,box-shadow] focus-within:border-primary/30 focus-within:shadow-[0_12px_36px_rgba(15,23,42,0.1)] focus-within:ring-primary/15 dark:from-card dark:to-muted/10 dark:ring-white/[0.04] dark:focus-within:ring-primary/20">
          <div className="pointer-events-none h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-focus-within/composer:opacity-100" />
          <div className="flex items-end gap-2 px-1 pb-1 pt-0.5">
            <div className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stel een vraag aan OpenClaw..."
              className="min-h-[42px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            <Button
              size="icon"
              disabled={!input.trim() || chatMutation.isPending}
              onClick={handleSend}
              aria-label="Bericht versturen"
              className={cn(
                "mb-0.5 h-9 w-9 shrink-0 rounded-xl transition-all",
                input.trim() && !chatMutation.isPending
                  ? "shadow-md shadow-primary/25 hover:scale-[1.03] active:scale-[0.97]"
                  : "bg-muted text-muted-foreground hover:bg-muted"
              )}
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="px-2 pb-0.5 text-[10px] text-muted-foreground/75">
            Enter om te versturen · Shift+Enter voor nieuwe regel
          </p>
        </div>
      </div>
    </div>
  );
}
