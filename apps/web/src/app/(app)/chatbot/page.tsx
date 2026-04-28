"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Badge,
  Input,
  Textarea,
  ScrollArea,
  Skeleton,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@digitify/ui";
import { cn } from "@digitify/ui";
import {
  MessageSquare,
  Search,
  Settings,
  Send,
  Trash2,
  Sparkles,
  Link2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Bot,
  User,
  Headset,
  StickyNote,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  FilePlus2,
} from "lucide-react";

/* ---------- Types ---------- */

type SessionStatus = "OPEN" | "WAITING" | "RESOLVED" | "ARCHIVED";

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; color: string; dot: string }
> = {
  OPEN: { label: "Open", color: "bg-green-500", dot: "bg-green-500" },
  WAITING: { label: "Wachtend", color: "bg-yellow-500", dot: "bg-yellow-500" },
  RESOLVED: { label: "Opgelost", color: "bg-blue-500", dot: "bg-blue-500" },
  ARCHIVED: {
    label: "Gearchiveerd",
    color: "bg-gray-400",
    dot: "bg-gray-400",
  },
};

const FILTER_TABS: { label: string; value: SessionStatus | "ALL" }[] = [
  { label: "Alle", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Wachtend", value: "WAITING" },
  { label: "Opgelost", value: "RESOLVED" },
  { label: "Gearchiveerd", value: "ARCHIVED" },
];

/* ---------- Helpers ---------- */

function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin}m geleden`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}u geleden`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d geleden`;
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

function formatTimestamp(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- Main component ---------- */

export default function ChatbotInboxPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SessionStatus | "ALL">(
    "ALL"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [replyText, setReplyText] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* ---------- Queries ---------- */

  const {
    data: listData,
    isLoading: listLoading,
  } = trpc.chatbot.listSessions.useQuery(
    {
      page,
      perPage: 20,
      status: activeFilter === "ALL" ? undefined : activeFilter,
      search: debouncedSearch || undefined,
    },
    { refetchInterval: 15000 }
  );

  const {
    data: session,
    isLoading: sessionLoading,
  } = trpc.chatbot.getSession.useQuery(
    { id: selectedId! },
    {
      enabled: !!selectedId,
      refetchOnWindowFocus: false,
    }
  );

  const { data: leadResults } = trpc.lead.list.useQuery(
    { page: 1, pageSize: 10, filters: { search: leadSearchQuery } },
    { enabled: linkDialogOpen && leadSearchQuery.length > 1 }
  );

  /* ---------- Mutations ---------- */

  const sendMessage = trpc.chatbot.sendMessage.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.chatbot.getSession.invalidate({ id: selectedId! });
      utils.chatbot.listSessions.invalidate();
    },
  });

  const updateSession = trpc.chatbot.updateSession.useMutation({
    onSuccess: () => {
      utils.chatbot.getSession.invalidate({ id: selectedId! });
      utils.chatbot.listSessions.invalidate();
    },
  });

  const generateSummary = trpc.chatbot.generateSummary.useMutation({
    onSuccess: () => {
      utils.chatbot.getSession.invalidate({ id: selectedId! });
      utils.chatbot.listSessions.invalidate();
    },
  });

  const convertToLead = trpc.chatbot.convertToLead.useMutation({
    onSuccess: () => {
      utils.chatbot.getSession.invalidate({ id: selectedId! });
      utils.chatbot.listSessions.invalidate();
    },
  });

  const convertToBooking = trpc.chatbot.convertToBooking.useMutation({
    onSuccess: () => {
      utils.chatbot.getSession.invalidate({ id: selectedId! });
      utils.chatbot.listSessions.invalidate();
    },
  });

  const startLiveTakeover = trpc.chatbot.startLiveTakeover.useMutation({
    onSuccess: () => {
      utils.chatbot.getSession.invalidate({ id: selectedId! });
      utils.chatbot.listSessions.invalidate();
    },
  });

  const linkToLead = trpc.chatbot.linkToLead.useMutation({
    onSuccess: () => {
      setLinkDialogOpen(false);
      setLeadSearchQuery("");
      utils.chatbot.getSession.invalidate({ id: selectedId! });
      utils.chatbot.listSessions.invalidate();
    },
  });

  const deleteSession = trpc.chatbot.deleteSession.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      setDeleteConfirmId(null);
      utils.chatbot.listSessions.invalidate();
    },
  });

  /* ---------- Handlers ---------- */

  function handleSendReply() {
    if (!selectedId || !replyText.trim()) return;
    sendMessage.mutate({ sessionId: selectedId, content: replyText.trim() });
  }

  function handleStatusChange(status: SessionStatus) {
    if (!selectedId) return;
    updateSession.mutate({ id: selectedId, status });
  }

  function handleSaveNotes() {
    if (!selectedId) return;
    updateSession.mutate({ id: selectedId, internalNotes });
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  // Sync internal notes when session changes
  useEffect(() => {
    if (session) {
      setInternalNotes((session as any).internalNotes || "");
    }
  }, [session?.id]);

  const sessions = listData?.sessions ?? [];
  const unreadCount = listData?.unreadCount ?? 0;
  const isMac = typeof window !== "undefined" && window.navigator.platform.toLowerCase().includes("mac");

  return (
    <div className="app-page">
      {/* Page header */}
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Chatbot Gesprekken
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount} ongelezen
              </Badge>
            )}
          </h1>
          <p className="app-page-subtitle">
            Bekijk en beheer chatbot gesprekken met bezoekers
          </p>
        </div>
        <div className="app-page-actions">
          <Link href="/chatbot/settings">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Instellingen
          </Button>
          </Link>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-3 md:h-[calc(100dvh-11.5rem)] md:grid-cols-[33%_1fr]">
        {/* ======== LEFT PANEL: Session list ======== */}
        <Card className={cn("flex min-h-[340px] flex-col overflow-hidden md:min-h-0", selectedId ? "hidden md:flex" : "")}>
          {/* Search */}
          <div className="space-y-2 border-b p-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op naam, e-mail, bedrijf..."
                className="h-9 pl-9 text-sm"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveFilter(tab.value);
                    setPage(1);
                  }}
                  className={cn(
                    "whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    activeFilter === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Session list */}
          <ScrollArea className="flex-1">
            {listLoading ? (
              <div className="space-y-1 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2 p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Geen gesprekken gevonden
                </p>
              </div>
            ) : (
              <div>
                {sessions.map((s: any) => {
                  const lastMsg = s.messages?.[0];
                  const statusCfg =
                    STATUS_CONFIG[s.status as SessionStatus] ??
                    STATUS_CONFIG.OPEN;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        "w-full border-b border-border/70 p-2.5 text-left transition-colors hover:bg-accent/50",
                        selectedId === s.id && "bg-accent",
                        !s.isRead && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {/* Status dot */}
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full shrink-0",
                                statusCfg.dot
                              )}
                            />
                            {/* Unread indicator */}
                            {!s.isRead && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                            <p
                              className={cn(
                                "text-sm truncate",
                                !s.isRead
                                  ? "font-semibold"
                                  : "font-medium"
                              )}
                            >
                              {s.visitorName || "Anonieme Bezoeker"}
                            </p>
                          </div>
                          {/* Visitor info */}
                          {(s.visitorEmail || s.visitorCompany) && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                              {s.visitorEmail && (
                                <span className="truncate">{s.visitorEmail}</span>
                              )}
                              {s.visitorEmail && s.visitorCompany && (
                                <span>-</span>
                              )}
                              {s.visitorCompany && (
                                <span className="truncate font-medium">{s.visitorCompany}</span>
                              )}
                            </div>
                          )}
                          {/* Last message preview */}
                          {lastMsg && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {lastMsg.content?.substring(0, 80)}
                              {lastMsg.content?.length > 80 ? "..." : ""}
                            </p>
                          )}
                          {/* Intent badge */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 h-4"
                            >
                              {statusCfg.label}
                            </Badge>
                            {s.intent && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 h-4"
                              >
                                {s.intent.replace(/_/g, " ")}
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 h-4"
                            >
                              {s._count?.messages ?? 0} berichten
                            </Badge>
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                          {timeAgo(s.updatedAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {listData && listData.totalPages > 1 && (
            <div className="flex items-center justify-between p-2 border-t text-xs text-muted-foreground">
              <span>
                Pagina {listData.page} van {listData.totalPages} ({listData.total} totaal)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= listData.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ======== RIGHT PANEL: Conversation detail ======== */}
        <Card className={cn("flex min-h-[420px] flex-col overflow-hidden md:min-h-0", !selectedId ? "hidden md:flex" : "")}>
          {!selectedId ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">
                Selecteer een gesprek om te bekijken
              </p>
            </div>
          ) : sessionLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Separator />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : session ? (
            <>
              {/* Session header */}
              <div className="space-y-2 border-b p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mb-2 h-7 px-2 text-xs md:hidden"
                      onClick={() => setSelectedId(null)}
                    >
                      <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                      Terug naar gesprekken
                    </Button>
                    <h2 className="text-lg font-semibold">
                      {session.visitorName || "Anonieme Bezoeker"}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {session.visitorEmail && (
                        <span>{session.visitorEmail}</span>
                      )}
                      {session.visitorPhone && (
                        <span>{session.visitorPhone}</span>
                      )}
                      {session.visitorCompany && (
                        <span>{session.visitorCompany}</span>
                      )}
                    </div>
                    {session.pageUrl && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                        Pagina: {session.pageUrl}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={cn(
                      "text-white",
                      STATUS_CONFIG[session.status as SessionStatus]?.color ??
                        "bg-gray-400"
                    )}
                  >
                    {STATUS_CONFIG[session.status as SessionStatus]?.label ??
                      session.status}
                  </Badge>
                </div>

                {/* Action bar */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status dropdown */}
                  <Select
                    value={session.status}
                    onValueChange={(v) =>
                      handleStatusChange(v as SessionStatus)
                    }
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="WAITING">Wachtend</SelectItem>
                      <SelectItem value="RESOLVED">Opgelost</SelectItem>
                      <SelectItem value="ARCHIVED">Gearchiveerd</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Link/Create lead */}
                  {session.lead ? (
                    <Link href={`/leads/${session.lead.id}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        <ExternalLink className="mr-1.5 h-3 w-3" />
                        {session.lead.companyName}
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setLinkDialogOpen(true)}
                      >
                        <Link2 className="mr-1.5 h-3 w-3" />
                        Koppel Lead
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => convertToLead.mutate({ sessionId: selectedId! })}
                        disabled={convertToLead.isPending}
                      >
                        {convertToLead.isPending ? (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                          <UserPlus className="mr-1.5 h-3 w-3" />
                        )}
                        Maak Lead
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => selectedId && router.push(`/quotes/new?chatSessionId=${selectedId}`)}
                    disabled={!selectedId}
                  >
                    <FilePlus2 className="mr-1.5 h-3 w-3" />
                    Naar offerte
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() =>
                      convertToBooking.mutate({
                        sessionId: selectedId!,
                        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        duration: 60,
                      })
                    }
                    disabled={convertToBooking.isPending}
                  >
                    <CalendarPlus className="mr-1.5 h-3 w-3" />
                    Naar boeking
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => startLiveTakeover.mutate({ sessionId: selectedId! })}
                    disabled={startLiveTakeover.isPending}
                  >
                    <Headset className="mr-1.5 h-3 w-3" />
                    Live takeover
                  </Button>

                  {/* AI Summary */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() =>
                      generateSummary.mutate({ sessionId: selectedId! })
                    }
                    disabled={generateSummary.isPending}
                  >
                    {generateSummary.isPending ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3 w-3" />
                    )}
                    AI Samenvatting
                  </Button>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirmId(selectedId)}
                  >
                    <Trash2 className="mr-1.5 h-3 w-3" />
                    Verwijder
                  </Button>
                </div>

                {/* Summary display */}
                {session.summary && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">Samenvatting:</span>{" "}
                    {session.summary}
                    {session.intent && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {session.intent.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Linked lead card */}
                {session.lead && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-medium">Gekoppelde lead:</span>{" "}
                    <Link
                      href={`/leads/${session.lead.id}`}
                      className="text-primary hover:underline"
                    >
                      {session.lead.companyName}
                    </Link>
                    {session.lead.city && (
                      <span className="text-muted-foreground">
                        {" "}
                        - {session.lead.city}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Message thread */}
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {session.messages.map((msg: any) => {
                    const isVisitor = msg.role === "VISITOR";
                    const isBot = msg.role === "BOT";
                    const isAgent = msg.role === "AGENT";

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isVisitor ? "justify-start" : "justify-end"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-2.5 py-2 text-[13px] leading-5",
                            isVisitor &&
                              "rounded-bl-md border border-slate-200 bg-white text-foreground",
                            isBot &&
                              "rounded-br-md border border-slate-200 bg-slate-50 text-foreground",
                            isAgent &&
                              "rounded-br-md bg-blue-600 text-white"
                          )}
                        >
                          {/* Role label */}
                          <div
                            className={cn(
                              "mb-1 flex items-center gap-1 text-[10px]",
                              isAgent
                                ? "text-blue-100"
                                : "text-muted-foreground"
                            )}
                          >
                            {isVisitor && (
                              <User className="h-3 w-3" />
                            )}
                            {isBot && <Bot className="h-3 w-3" />}
                            {isAgent && (
                              <Headset className="h-3 w-3" />
                            )}
                            <span>
                              {isVisitor
                                ? "Bezoeker"
                                : isBot
                                  ? "Bot"
                                  : "Agent"}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              isAgent
                                ? "text-blue-200"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatTimestamp(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Internal notes (collapsible) */}
              <div className="border-t">
                <button
                  onClick={() => setNotesOpen(!notesOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <StickyNote className="h-3 w-3" />
                    Interne notities
                  </span>
                  {notesOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronUp className="h-3 w-3" />
                  )}
                </button>
                {notesOpen && (
                  <div className="px-4 pb-3 space-y-2">
                    <Textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Voeg interne notities toe..."
                      rows={3}
                      className="text-xs resize-none"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleSaveNotes}
                      disabled={updateSession.isPending}
                    >
                      {updateSession.isPending ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : null}
                      Notities opslaan
                    </Button>
                  </div>
                )}
              </div>

              {/* Reply input */}
              <div className="border-t p-2.5">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Typ een antwoord als agent..."
                      rows={2}
                      className="resize-none text-[13px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleSendReply();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">
                        {isMac ? "\u2318" : "Ctrl"}+Enter om te versturen
                      </p>
                      {sendMessage.isError && (
                        <p className="text-[10px] text-destructive">
                          Verzenden mislukt. Probeer opnieuw.
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleSendReply}
                    disabled={
                      sendMessage.isPending || !replyText.trim()
                    }
                    size="sm"
                    className="h-8 px-3 text-xs"
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1.5" />
                        Verstuur
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </Card>
      </div>

      {/* ======== Link to Lead Dialog ======== */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koppel aan bestaande lead</DialogTitle>
            <DialogDescription>
              Zoek een lead om dit gesprek aan te koppelen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={leadSearchQuery}
              onChange={(e) => setLeadSearchQuery(e.target.value)}
              placeholder="Zoek op bedrijfsnaam..."
            />
            {leadResults && leadResults.items?.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {leadResults.items.map((lead: any) => (
                  <button
                    key={lead.id}
                    onClick={() =>
                      linkToLead.mutate({
                        sessionId: selectedId!,
                        leadId: lead.id,
                      })
                    }
                    className="w-full text-left p-2 rounded-md hover:bg-accent text-sm flex items-center justify-between"
                    disabled={linkToLead.isPending}
                  >
                    <div>
                      <p className="font-medium">{lead.companyName}</p>
                      {lead.city && (
                        <p className="text-xs text-muted-foreground">
                          {lead.city}
                        </p>
                      )}
                    </div>
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : leadSearchQuery.length > 1 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Geen leads gevonden
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Typ om te zoeken...
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
            >
              Annuleren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Delete Confirm Dialog ======== */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gesprek verwijderen?</DialogTitle>
            <DialogDescription>
              Dit gesprek en alle berichten worden permanent verwijderd. Dit kan
              niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmId &&
                deleteSession.mutate({ id: deleteConfirmId })
              }
              disabled={deleteSession.isPending}
            >
              {deleteSession.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
