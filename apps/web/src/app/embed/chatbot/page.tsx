"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type RemoteSettings = {
  enabled: boolean;
  companyName: string;
  companySlogan: string;
  welcomeMessage: string;
  offlineMessage: string;
  primaryColor: string;
  avatarUrl: string;
  autoMessagesEnabled: boolean;
  aiResponsesEnabled: boolean;
  askNameBeforeChat: boolean;
  preChatQuestions: PreChatQuestion[];
};

type PreChatQuestion = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "company" | "select";
  required: boolean;
  options?: string[];
};

type ChatMessage = {
  id?: string;
  role: "BOT" | "VISITOR" | "AGENT";
  content: string;
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeHexColor(value: string, fallback = "#6366f1") {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function parseBooleanParam(value: string | null, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function ChatbotEmbedContent() {
  const params = useSearchParams();
  const tenant = params.get("tenant") || "";
  const [settings, setSettings] = useState<RemoteSettings | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [preChatComplete, setPreChatComplete] = useState(false);
  const [visitorFields, setVisitorFields] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sentNotice, setSentNotice] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch(`/api/public/chatbot/settings${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((remote: RemoteSettings | null) => {
        if (!mounted || !remote) return;
        setSettings(remote);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [tenant]);

  useEffect(() => {
    if (!sessionId) return;

    const timer = window.setInterval(() => {
      fetch(`/api/public/chatbot/session?sessionId=${encodeURIComponent(sessionId)}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (!payload?.messages) return;
          setMessages(payload.messages);
        })
        .catch(() => {});
    }, 4000);

    return () => window.clearInterval(timer);
  }, [sessionId, tenant]);

  const companyName = params.get("company") || settings?.companyName || "Digitify";
  const companySlogan = settings?.companySlogan || "";
  const primaryColor = normalizeHexColor(params.get("color") || settings?.primaryColor || "#6366f1");
  const welcomeMessage = params.get("welcome") || settings?.welcomeMessage || "Hallo! Hoe kan ik u helpen?";
  const enabled = settings?.enabled ?? true;
  const autoMessagesEnabled = settings?.autoMessagesEnabled ?? true;
  const avatarUrl = settings?.avatarUrl || "";
  const preChatQuestions = settings?.preChatQuestions || [];
  const askNameBeforeChat = parseBooleanParam(
    params.get("askName"),
    settings?.askNameBeforeChat ?? false,
  );

  const softTint = useMemo(() => hexToRgba(primaryColor, 0.1), [primaryColor]);

  useEffect(() => {
    if (messages.length > 0) return;
    if (!autoMessagesEnabled) return;
    if ((askNameBeforeChat || preChatQuestions.length > 0) && !preChatComplete) return;

    setMessages([
      {
        role: "BOT",
        content: enabled ? welcomeMessage : settings?.offlineMessage || "We zijn momenteel offline.",
      },
    ]);
  }, [messages.length, autoMessagesEnabled, askNameBeforeChat, preChatQuestions.length, preChatComplete, enabled, welcomeMessage, settings?.offlineMessage]);

  const shouldShowPreChat = (askNameBeforeChat || preChatQuestions.length > 0) && !preChatComplete;
  const sendDisabled = shouldShowPreChat || loading || !input.trim();

  async function handleSend() {
    const message = input.trim();
    if (!message || shouldShowPreChat) return;

    setLoading(true);
    setSentNotice("");
    setMessages((current) => [...current, { role: "VISITOR", content: message }]);
    setInput("");

    try {
      const response = await fetch("/api/public/chatbot/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          visitorName: visitorName || undefined,
          visitorFields,
          message,
          pageUrl: typeof document !== "undefined" ? document.referrer : undefined,
          tenant: tenant || undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSessionId(data.sessionId);
        if (data.reply) {
          setMessages((current) => [
            ...current,
            { id: `bot-${Date.now()}`, role: "BOT", content: data.reply || welcomeMessage },
          ]);
        } else if (data.accepted) {
          setSentNotice("Bericht ontvangen. We volgen dit manueel op.");
        }
      } else {
        setMessages((current) => [
          ...current,
          { id: `bot-error-${Date.now()}`, role: "BOT", content: data.error || "Er ging iets mis bij het verzenden." },
        ]);
      }
    } catch {
      setMessages((current) => [
        ...current,
        { id: `bot-network-${Date.now()}`, role: "BOT", content: "Netwerkfout. Probeer opnieuw." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleStartChat() {
    const candidate = nameDraft.trim();
    if (askNameBeforeChat && !candidate) {
      setNameError("Vul eerst je naam in.");
      return;
    }
    const nextErrors: Record<string, string> = {};
    for (const question of preChatQuestions) {
      const value = (visitorFields[question.id] || "").trim();
      if (question.required && !value) {
        nextErrors[question.id] = "Vul dit veld in.";
      }
      if (question.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        nextErrors[question.id] = "Vul een geldig e-mailadres in.";
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setVisitorName(candidate);
    setPreChatComplete(true);
    setNameError("");
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.97),_rgba(248,250,252,0.97)_40%,_rgba(241,245,249,1)_100%)] text-slate-900"
      style={{ backgroundColor: softTint }}
    >
      <div className="relative overflow-hidden px-3 py-2.5 text-white sm:px-4" style={{ backgroundColor: primaryColor }}>
        <div className="relative flex items-start gap-2.5">
          {avatarUrl ? (
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/15 shadow">
              <img src={avatarUrl} alt={companyName} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/15 text-sm font-semibold shadow">
              {companyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tracking-tight">{companyName}</div>
            {companySlogan ? (
              <div className="mt-0.5 line-clamp-1 text-[11px] text-white/80">{companySlogan}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-2.5 py-3 sm:px-3">
        {shouldShowPreChat ? (
          <div className="mx-auto mt-3 w-full max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Start chat</p>
            <p className="mt-1 text-xs text-slate-600">
              Vul de gegevens in voordat je het eerste bericht verstuurt.
            </p>
            {askNameBeforeChat ? (
              <>
                <input
                  value={nameDraft}
                  onChange={(event) => {
                    setNameDraft(event.target.value);
                    if (nameError) setNameError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleStartChat();
                    }
                  }}
                  placeholder="Jouw naam"
                  className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                />
                {nameError ? <p className="mt-1.5 text-[11px] text-red-600">{nameError}</p> : null}
              </>
            ) : null}
            {preChatQuestions.map((question) => (
              <div key={question.id} className="mt-3">
                <label className="text-xs font-medium text-slate-700">
                  {question.label}
                  {question.required ? " *" : ""}
                </label>
                {question.type === "select" ? (
                  <select
                    value={visitorFields[question.id] || ""}
                    onChange={(event) => {
                      setVisitorFields((current) => ({ ...current, [question.id]: event.target.value }));
                      setFieldErrors((current) => ({ ...current, [question.id]: "" }));
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="">Kies een optie</option>
                    {(question.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={visitorFields[question.id] || ""}
                    type={question.type === "email" ? "email" : question.type === "phone" ? "tel" : "text"}
                    onChange={(event) => {
                      setVisitorFields((current) => ({ ...current, [question.id]: event.target.value }));
                      setFieldErrors((current) => ({ ...current, [question.id]: "" }));
                    }}
                    placeholder={question.type === "email" ? "naam@voorbeeld.be" : question.type === "phone" ? "+32 ..." : ""}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
                  />
                )}
                {fieldErrors[question.id] ? <p className="mt-1.5 text-[11px] text-red-600">{fieldErrors[question.id]}</p> : null}
              </div>
            ))}
            <button
              type="button"
              onClick={handleStartChat}
              className="mt-3 h-10 w-full rounded-xl text-sm font-semibold text-white transition hover:opacity-95"
              style={{ backgroundColor: primaryColor }}
            >
              Start chat
            </button>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "VISITOR" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-5 shadow-[0_1px_2px_rgba(15,23,42,0.07)] sm:max-w-[82%] ${
                message.role === "VISITOR"
                  ? "rounded-br-md text-white"
                  : message.role === "AGENT"
                    ? "rounded-bl-md border border-amber-200/80 bg-amber-50 text-slate-800"
                    : "rounded-bl-md border border-slate-200/90 bg-white/95 text-slate-700"
              }`}
              style={
                message.role === "VISITOR"
                  ? { backgroundColor: primaryColor }
                  : message.role === "BOT"
                    ? { boxShadow: `0 10px 24px ${softTint}` }
                    : undefined
              }
            >
              {message.content}
            </div>
          </div>
        ))}
        {sentNotice ? (
          <div className="mx-auto max-w-[88%] rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-center text-[11px] text-slate-500">
            {sentNotice}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200/80 bg-white/95 p-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={
              shouldShowPreChat
                ? "Vul eerst de startvragen in"
                : !enabled
                  ? "Chatbot is momenteel offline"
                  : autoMessagesEnabled
                    ? "Typ je bericht..."
                    : "Laat een bericht achter voor manuele opvolging"
            }
            disabled={loading || shouldShowPreChat}
            className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400 disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sendDisabled}
            className="h-10 shrink-0 rounded-xl px-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {loading ? "..." : "Verstuur"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatbotEmbedFallback() {
  return (
    <div className="flex h-screen flex-col bg-white text-slate-900">
      <div className="h-14 animate-pulse bg-slate-900/90" />
      <div className="flex-1 space-y-2 bg-slate-50 px-3 py-3">
        <div className="h-14 w-3/4 animate-pulse rounded-2xl bg-white" />
        <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="border-t border-slate-200 bg-white p-2.5">
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function ChatbotEmbedPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ChatbotEmbedFallback />;

  return (
    <Suspense fallback={<ChatbotEmbedFallback />}>
      <ChatbotEmbedContent />
    </Suspense>
  );
}
