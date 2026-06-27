import { NextResponse } from "next/server";
import { prisma, revealSettingValue } from "@digitify/db";
import {
  ensurePublicTenantToken,
  resolveMarketingWorkspaceOwnerId,
  resolvePublicTenantUserId,
} from "@digitify/api/src/lib/public-tenant";
import { log } from "@digitify/api/src/lib/logger";
import { createHash } from "node:crypto";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

const recentMessages = new Map<string, number>();

type IntentResult = {
  intent: string;
  tags: string[];
};

type FallbackReply = IntentResult & {
  reply: string;
  summary: string;
};

type PreChatQuestion = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "company" | "select";
  required: boolean;
  options: string[];
};

type AiConfig = {
  provider: "anthropic" | "openai" | "deepseek";
  model: string;
  apiKey: string;
  maxTokens: number;
};

type ChatHistoryMessage = {
  role: "BOT" | "VISITOR" | "AGENT";
  content: string;
};

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

function tenantTag(userId: string) {
  return `tenant:${userId}`;
}

function getSetting(settings: Array<{ key: string; value: unknown }>, key: string, fallback: string) {
  const row = settings.find((item) => item.key === key);
  if (!row) return fallback;
  const resolvedValue = revealSettingValue(key, row.value);
  if (resolvedValue === null || resolvedValue === undefined) return fallback;
  if (typeof resolvedValue !== "string") return String(resolvedValue);
  const raw = resolvedValue.trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean") {
      return String(parsed);
    }
  } catch {
    // raw string
  }
  return raw;
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

function detectIntent(message: string): IntentResult {
  const text = message.toLowerCase();
  const rules = [
    { intent: "booking", tags: ["booking"], patterns: [/afspraak/, /boeken/, /beschikbaar/, /agenda/, /meeting/] },
    { intent: "quote_request", tags: ["quote"], patterns: [/offerte/, /voorstel/, /prijsopgave/, /prijs/, /kost/] },
    { intent: "support", tags: ["support"], patterns: [/probleem/, /werkt niet/, /help/, /fout/, /bug/] },
    { intent: "contact", tags: ["contact"], patterns: [/mail/, /bellen/, /telefoon/, /contact/, /terugbellen/] },
    {
      intent: "service_interest",
      tags: ["service"],
      patterns: [/website/, /seo/, /marketing/, /chatbot/, /reviews/, /boekingen/],
    },
  ];

  const matched = rules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  return matched || { intent: "general_info", tags: ["general"] };
}

function extractEmail(message: string) {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function extractPhone(message: string) {
  return message.match(/(?:\+?\d[\d\s()./-]{7,}\d)/)?.[0]?.trim() || null;
}

function normalizeTextForCompare(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseMaxTokens(raw: string) {
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 256 && parsed <= 8192) return Math.round(parsed);
  return 1024;
}

function parseBooleanValue(raw: string, fallback: boolean) {
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePreChatQuestions(raw: string): PreChatQuestion[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const label = typeof record.label === "string" ? record.label.trim().slice(0, 120) : "";
        if (!label) return null;
        const type =
          record.type === "email" || record.type === "phone" || record.type === "company" || record.type === "select"
            ? record.type
            : "text";
        const id =
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40)
            : `vraag_${index + 1}`;
        const options = Array.isArray(record.options)
          ? record.options
              .map((option) => (typeof option === "string" ? option.trim().slice(0, 80) : ""))
              .filter(Boolean)
              .slice(0, 8)
          : [];
        return { id, label, type, required: record.required !== false, options };
      })
      .filter((question): question is PreChatQuestion => Boolean(question))
      .slice(0, 8);
  } catch {
    return [];
  }
}

function normalizeVisitorFields(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
    if (!safeKey) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      output[safeKey] = String(value).trim().slice(0, 500);
    }
  }
  return output;
}

function getAiConfig(settings: Array<{ key: string; value: unknown }>): AiConfig | null {
  const providerRaw = getSetting(settings, "api.ai_provider", "anthropic").toLowerCase();
  const provider: AiConfig["provider"] =
    providerRaw === "openai" ? "openai" : providerRaw === "deepseek" ? "deepseek" : "anthropic";
  const model = getSetting(
    settings,
    "openclaw.model",
    provider === "openai" ? "gpt-4o-mini" : provider === "deepseek" ? "deepseek-chat" : "claude-sonnet-4-20250514",
  );

  const apiKey =
    provider === "openai"
      ? getSetting(settings, "api.openai_key", process.env.OPENAI_API_KEY || "")
      : provider === "deepseek"
        ? getSetting(settings, "api.deepseek_key", process.env.DEEPSEEK_API_KEY || "")
        : getSetting(settings, "api.anthropic_key", process.env.ANTHROPIC_API_KEY || "");

  if (!apiKey.trim()) return null;

  return {
    provider,
    model,
    apiKey: apiKey.trim(),
    maxTokens: parseMaxTokens(getSetting(settings, "openclaw.max_tokens", "1024")),
  };
}

function buildFallbackReply(message: string, options: {
  companyName: string;
  website: string;
  email: string;
  phone: string;
  bookingUrl: string;
  offlineMessage: string;
  trainingNotes: string;
  enabled: boolean;
  autoMessagesEnabled: boolean;
  aiResponsesEnabled: boolean;
}): FallbackReply {
  if (!options.enabled) {
    return {
      reply: options.offlineMessage,
      intent: "offline",
      tags: ["offline"],
      summary: "Chatbot stond offline.",
    };
  }

  if (!options.autoMessagesEnabled) {
    return {
      reply: "",
      intent: "manual_only",
      tags: ["manual-only"],
      summary: `${options.companyName}: automatisch antwoorden uitgeschakeld.`,
    };
  }

  const match = detectIntent(message);
  const baseSummary = `${options.companyName}: ${match.intent}`;

  if (!options.aiResponsesEnabled) {
    return {
      reply: `Bedankt voor uw bericht aan ${options.companyName}. We hebben het goed ontvangen en volgen dit zo snel mogelijk intern op.`,
      intent: match.intent,
      tags: [...match.tags, "manual-followup"],
      summary: `${baseSummary} - eenvoudige automatische ontvangstbevestiging.`,
    };
  }

  switch (match.intent) {
    case "booking":
      return {
        reply: options.bookingUrl
          ? `Bedankt. Als u een afspraak wilt inplannen, kunt u hier meteen verder: ${options.bookingUrl}. Laat gerust ook uw vraag of voorkeursmoment achter, dan volgen we dit intern op.`
          : `Bedankt. We hebben uw vraag over een afspraak goed ontvangen. Laat gerust uw voorkeursmoment achter, dan nemen we dit intern op en komen we snel bij u terug.`,
        intent: match.intent,
        tags: match.tags,
        summary: `${baseSummary} - bezoeker vraagt een afspraak aan.`,
      };
    case "quote_request":
      return {
        reply: `Bedankt voor uw interesse. We hebben uw vraag rond prijs of offerte goed ontvangen. Laat eventueel nog kort weten waar u precies hulp bij zoekt, dan maken we dit intern concreet voor ${options.companyName}.`,
        intent: match.intent,
        tags: match.tags,
        summary: `${baseSummary} - bezoeker vraagt prijs of offerte.`,
      };
    case "support":
      return {
        reply: `Bedankt om dit te melden. Beschrijf gerust zo concreet mogelijk wat er misloopt. We registreren dit intern zodat iemand van ${options.companyName} dit snel kan opvolgen.`,
        intent: match.intent,
        tags: match.tags,
        summary: `${baseSummary} - bezoeker meldt een probleem.`,
      };
    case "contact":
      return {
        reply: `We hebben uw contactvraag goed ontvangen.${options.email ? ` U kunt ons ook bereiken via ${options.email}.` : ""}${options.phone ? ` Telefonisch zijn we bereikbaar op ${options.phone}.` : ""}`,
        intent: match.intent,
        tags: match.tags,
        summary: `${baseSummary} - bezoeker vraagt contactinformatie.`,
      };
    case "service_interest":
      return {
        reply: `Bedankt voor uw bericht. We helpen bedrijven met ${options.companyName} graag verder rond digitale groei. Laat gerust wat extra context achter zodat we uw vraag juist kunnen doorzetten.${options.trainingNotes ? ` Relevante context: ${options.trainingNotes}` : ""}${options.website ? ` Meer info vindt u ook op ${options.website}.` : ""}`,
        intent: match.intent,
        tags: match.tags,
        summary: `${baseSummary} - bezoeker toont interesse in diensten.`,
      };
    default:
      return {
        reply: `Bedankt voor uw bericht aan ${options.companyName}. We hebben het goed ontvangen en komen zo snel mogelijk bij u terug.${options.trainingNotes ? ` ${options.trainingNotes}` : ""}`,
        intent: match.intent,
        tags: match.tags,
        summary: `${baseSummary} - algemeen bericht.`,
      };
  }
}

function buildSystemPrompt(input: {
  companyName: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  niche: string;
  bookingUrl: string;
  trainingNotes: string;
  knowledgePages: string;
  responseStyle: string;
  language: string;
  pageUrl: string;
}) {
  const lines = [
    `Je bent de klantenchat-assistent van ${input.companyName}.`,
    `Schrijf in ${input.language || "Nederlands"}, tenzij de bezoeker duidelijk een andere taal gebruikt.`,
    "Geef korte, bruikbare antwoorden (max 5 zinnen), zonder marketingfluff.",
    "Gebruik concrete informatie uit de context hieronder.",
    "Als info ontbreekt: zeg dit kort en stel maximaal 1 verduidelijkende vraag.",
    "Nooit doen alsof je een boeking of bestelling al definitief bevestigde.",
  ];

  const safe = (v: string) => v.replace(/[\r\n]+/g, " ").trim();
  if (input.responseStyle) lines.push(`Gewenste schrijfstijl: ${safe(input.responseStyle)}.`);
  if (input.trainingNotes) lines.push(`Training/context: ${safe(input.trainingNotes)}`);
  if (input.website) lines.push(`Website: ${safe(input.website)}`);
  if (input.email) lines.push(`Contact e-mail: ${safe(input.email)}`);
  if (input.phone) lines.push(`Telefoon: ${safe(input.phone)}`);
  if (input.address) lines.push(`Adres: ${safe(input.address)}`);
  if (input.niche) lines.push(`Niche/sector: ${safe(input.niche)}`);
  if (input.bookingUrl) lines.push(`Booking link: ${safe(input.bookingUrl)}`);
  if (input.knowledgePages) lines.push(`Belangrijke pagina's/kennisbronnen: ${safe(input.knowledgePages)}`);
  if (input.pageUrl) lines.push(`Bezoeker komt van pagina: ${safe(input.pageUrl)}`);

  lines.push(
    "Als de vraag gaat over afspraak/planning, verwijs dan naar de booking link als die beschikbaar is.",
    "Hou de tone of voice professioneel, vriendelijk en oplossingsgericht."
  );

  return lines.join("\n");
}

async function callOpenAi(config: AiConfig, systemPrompt: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const endpoint =
    config.provider === "deepseek"
      ? "https://api.deepseek.com/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.35,
      max_tokens: Math.min(config.maxTokens, 800),
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI fout (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callAnthropic(config: AiConfig, systemPrompt: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: Math.min(config.maxTokens, 800),
      temperature: 0.35,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic fout (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return data.content?.find((part) => part.type === "text")?.text?.trim() || "";
}

async function generateAiReply(args: {
  config: AiConfig;
  systemPrompt: string;
  history: ChatHistoryMessage[];
  message: string;
}) {
  const conversation: Array<{ role: "user" | "assistant"; content: string }> = args.history
    .slice(-8)
    .map((item) => ({
      role: item.role === "VISITOR" ? "user" : "assistant",
      content: item.content,
    }));

  conversation.push({ role: "user", content: args.message });

  if (args.config.provider === "openai" || args.config.provider === "deepseek") {
    return callOpenAi(args.config, args.systemPrompt, conversation);
  }
  return callAnthropic(args.config, args.systemPrompt, conversation);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();
  const tenantToken = url.searchParams.get("tenant")?.trim() || "";
  const tenantUserId = tenantToken
    ? await resolvePublicTenantUserId(prisma, tenantToken)
    : await resolveMarketingWorkspaceOwnerId(prisma);
  const ip = getClientIp(request);

  if (!sessionId) {
    return NextResponse.json({ error: "Sessie is verplicht." }, { status: 400 });
  }
  if (!tenantUserId) {
    log.security.warn("Public chatbot session GET rejected: invalid tenant token", { ip });
    return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });
  }
  const limiter = await enforceRateLimit(request, {
    key: `public-chatbot-get:${tenantUserId}:${sessionId}:${ip}`,
    limit: 180,
    windowMs: 60 * 60 * 1000,
    message: "Te veel aanvragen. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  const session = await prisma.chatSession.findFirst({
    where: {
      AND: [
        { id: sessionId },
        {
          OR: [
            { assignedToId: tenantUserId },
            { tags: { has: tenantTag(tenantUserId) } },
            { lead: { createdById: tenantUserId } },
          ],
        },
      ],
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Sessie niet gevonden." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    sessionId: session.id,
    status: session.status,
    messages: session.messages
      .filter((message) => ["VISITOR", "BOT", "AGENT"].includes(message.role))
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
  });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const body = await request.json();
    const message = String(body.message || "").trim();
    const requestedSessionId = String(body.sessionId || "").trim();
    const requestedVisitorName = String(body.visitorName || "").trim();
    const visitorFields = normalizeVisitorFields(body.visitorFields);
    const pageUrl = String(body.pageUrl || "").trim();
    const tenantToken = String(body.tenant || "").trim();
    const tenantUserId = tenantToken
      ? await resolvePublicTenantUserId(prisma, tenantToken)
      : await resolveMarketingWorkspaceOwnerId(prisma);

    if (!message) {
      return NextResponse.json({ error: "Bericht is verplicht." }, { status: 400 });
    }
    if (!tenantUserId) {
      log.security.warn("Public chatbot POST rejected: invalid tenant token", { ip });
      return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });
    }
    const burstLimiter = await enforceRateLimit(request, {
      key: `public-chatbot-burst:${tenantUserId}:${ip}`,
      limit: 8,
      windowMs: 60_000,
      message: "Te veel berichten op korte tijd. Probeer binnen enkele minuten opnieuw.",
    });
    if (burstLimiter) return burstLimiter;
    const hourlyLimiter = await enforceRateLimit(request, {
      key: `public-chatbot:${tenantUserId}:${ip}`,
      limit: 100,
      windowMs: 60 * 60 * 1000,
      message: "Te veel berichten op korte tijd. Probeer binnen enkele minuten opnieuw.",
    });
    if (hourlyLimiter) return hourlyLimiter;
    if (message.length > 4000) {
      return NextResponse.json({ error: "Bericht is te lang." }, { status: 400 });
    }
    if (requestedVisitorName.length > 120) {
      return NextResponse.json({ error: "Naam is te lang." }, { status: 400 });
    }

    const settingsKeys = [
      "chatbot.enabled",
      "chatbot.company_name",
      "chatbot.offline_message",
      "chatbot.training_notes",
      "chatbot.knowledge_pages",
      "chatbot.response_style",
      "chatbot.auto_messages_enabled",
      "chatbot.ai_responses_enabled",
      "chatbot.ask_name_before_chat",
      "chatbot.pre_chat_questions_json",
      "chatbot.language",
      "api.ai_provider",
      "api.openai_key",
      "api.anthropic_key",
      "api.deepseek_key",
      "openclaw.model",
      "openclaw.max_tokens",
      "branding.company_name",
      "company.name",
      "company.niche",
      "company.website",
      "company.email",
      "company.phone",
      "company.address",
    ];

    const settingsRows = await prisma.setting.findMany({
      where: {
        key: {
          in: settingsKeys.map((key) => userSettingKey(tenantUserId, key)),
        },
      },
    });
    const settings = settingsRows.map((row) => ({
      ...row,
      key: row.key.replace(`user:${tenantUserId}:`, ""),
    }));

    const companyName =
      getSetting(settings, "chatbot.company_name", "") ||
      getSetting(settings, "company.name", "") ||
      getSetting(settings, "branding.company_name", "Digitify");
    const website = getSetting(settings, "company.website", "");
    const email = getSetting(settings, "company.email", "");
    const phone = getSetting(settings, "company.phone", "");
    const address = getSetting(settings, "company.address", "");
    const niche = getSetting(settings, "company.niche", "");
    const trainingNotes = getSetting(settings, "chatbot.training_notes", "");
    const knowledgePages = getSetting(settings, "chatbot.knowledge_pages", "");
    const responseStyle = getSetting(settings, "chatbot.response_style", "professioneel en helder");
    const language = getSetting(settings, "chatbot.language", "Nederlands");

    const enabled = parseBooleanValue(getSetting(settings, "chatbot.enabled", "true"), true);
    const autoMessagesEnabled = parseBooleanValue(getSetting(settings, "chatbot.auto_messages_enabled", "true"), true);
    const aiResponsesEnabled = parseBooleanValue(getSetting(settings, "chatbot.ai_responses_enabled", "true"), true);
    const askNameBeforeChat = parseBooleanValue(getSetting(settings, "chatbot.ask_name_before_chat", "false"), false);
    const preChatQuestions = parsePreChatQuestions(getSetting(settings, "chatbot.pre_chat_questions_json", ""));
    const offlineMessage = getSetting(
      settings,
      "chatbot.offline_message",
      "We zijn momenteel offline. Laat een bericht achter en we nemen zo snel mogelijk contact met u op."
    );
    const effectiveTenantToken = tenantToken || (tenantUserId ? await ensurePublicTenantToken(prisma, tenantUserId) : "");
    const bookingUrl = `${getAppUrl()}/embed/bookings?tenant=${encodeURIComponent(effectiveTenantToken)}`;

    const questionEmail = preChatQuestions.find((question) => question.type === "email" && visitorFields[question.id])?.id;
    const questionPhone = preChatQuestions.find((question) => question.type === "phone" && visitorFields[question.id])?.id;
    const questionCompany = preChatQuestions.find((question) => question.type === "company" && visitorFields[question.id])?.id;
    const extractedEmail = (questionEmail ? visitorFields[questionEmail] : "") || extractEmail(message);
    const extractedPhone = (questionPhone ? visitorFields[questionPhone] : "") || extractPhone(message);
    const extractedCompany = questionCompany ? visitorFields[questionCompany] : "";
    const existingSession = requestedSessionId
      ? await prisma.chatSession.findFirst({
          where: {
            AND: [
              { id: requestedSessionId },
              {
                OR: [
                  { assignedToId: tenantUserId },
                  { tags: { has: tenantTag(tenantUserId) } },
                  { lead: { createdById: tenantUserId } },
                ],
              },
            ],
          },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 12,
            },
          },
        })
      : null;

    const visitorName = requestedVisitorName || existingSession?.visitorName || "";
    if (askNameBeforeChat && !visitorName.trim()) {
      return NextResponse.json({ error: "Naam is verplicht vóór start chat." }, { status: 400 });
    }
    if (!existingSession) {
      for (const question of preChatQuestions) {
        const answer = (visitorFields[question.id] || "").trim();
        if (question.required && !answer) {
          return NextResponse.json({ error: `${question.label} is verplicht.` }, { status: 400 });
        }
        if (question.type === "email" && answer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
          return NextResponse.json({ error: `${question.label} bevat geen geldig e-mailadres.` }, { status: 400 });
        }
      }
    }

    const dedupeKey = createHash("sha256")
      .update(`${ip}|${tenantUserId}|${requestedSessionId}|${message.toLowerCase()}`)
      .digest("hex");
    const now = Date.now();
    for (const [key, ts] of recentMessages.entries()) {
      if (now - ts > 30_000) recentMessages.delete(key);
    }
    if (recentMessages.has(dedupeKey)) {
      return NextResponse.json(
        { error: "Dit bericht lijkt net al verstuurd." },
        { status: 409 },
      );
    }
    recentMessages.set(dedupeKey, now);

    const intent = detectIntent(message);
    const fallback = buildFallbackReply(message, {
      companyName,
      website,
      email,
      phone,
      bookingUrl,
      offlineMessage,
      trainingNotes,
      enabled,
      autoMessagesEnabled,
      aiResponsesEnabled,
    });

    const effectiveIntent = !enabled || !autoMessagesEnabled ? fallback.intent : intent.intent;
    const effectiveTags = Array.from(new Set([...intent.tags, ...fallback.tags, tenantTag(tenantUserId)]));
    const nextStatus = !enabled || !autoMessagesEnabled ? "WAITING" : "OPEN";
    const history = (existingSession?.messages || []).slice().reverse();

    let reply: string | null = fallback.reply || null;
    if (enabled && autoMessagesEnabled && aiResponsesEnabled) {
      const aiConfig = getAiConfig(settings);
      if (aiConfig) {
        try {
          const aiReply = await generateAiReply({
            config: aiConfig,
            systemPrompt: buildSystemPrompt({
              companyName,
              website,
              email,
              phone,
              address,
              niche,
              bookingUrl,
              trainingNotes,
              knowledgePages,
              responseStyle,
              language,
              pageUrl,
            }),
            history: history.map((item) => ({ role: item.role, content: item.content })),
            message,
          });

          if (aiReply) {
            reply = aiReply;
          }
        } catch (error) {
          log.integration.warn("Public chatbot AI fallback triggered", {
            tenantUserId,
            provider: aiConfig.provider,
            model: aiConfig.model,
          }, error);
          // Keep fallback response when AI provider fails.
        }
      }
    }

    const previousBot = history
      .slice()
      .reverse()
      .find((item) => item.role === "BOT")
      ?.content;
    if (reply && previousBot && normalizeTextForCompare(reply) === normalizeTextForCompare(previousBot)) {
      reply = `${reply}\n\nKan je kort aangeven wat voor jou nu het belangrijkste doel is?`;
    }

    const summary = `${companyName}: ${effectiveIntent}${message ? ` - ${message.slice(0, 120)}` : ""}`;

    const session = existingSession
      ? await prisma.chatSession.update({
          where: { id: existingSession.id },
          data: {
            assignedToId: existingSession.assignedToId || tenantUserId,
            updatedAt: new Date(),
            pageUrl: pageUrl || existingSession.pageUrl,
            isRead: false,
            status: nextStatus,
            visitorName: existingSession.visitorName || visitorName || null,
            visitorEmail: existingSession.visitorEmail || extractedEmail,
            visitorPhone: existingSession.visitorPhone || extractedPhone,
            visitorCompany: existingSession.visitorCompany || extractedCompany || null,
            intent: effectiveIntent,
            summary,
            tags: Array.from(
              new Set([
                ...(existingSession.tags || []),
                ...effectiveTags,
              ]),
            ),
          },
        })
      : await prisma.chatSession.create({
          data: {
            assignedToId: tenantUserId,
            pageUrl: pageUrl || null,
            isRead: false,
            status: nextStatus,
            visitorName: visitorName || null,
            visitorEmail: extractedEmail,
            visitorPhone: extractedPhone,
            visitorCompany: extractedCompany || null,
            intent: effectiveIntent,
            summary,
            tags: effectiveTags,
          },
        });

    await prisma.chatMessage.createMany({
      data: [
        {
          sessionId: session.id,
          role: "VISITOR",
            content: message,
            metadata: {
              visitorName: visitorName || null,
              pageUrl: pageUrl || null,
              email: extractedEmail,
              phone: extractedPhone,
              visitorFields,
              preChatQuestions: preChatQuestions.map((question) => ({
                id: question.id,
                label: question.label,
                type: question.type,
              })),
          },
        },
        ...(reply
          ? [
              {
                sessionId: session.id,
                role: "BOT" as const,
                content: reply,
                metadata: {
                  intent: effectiveIntent,
                  tags: effectiveTags,
                },
              },
            ]
          : []),
      ],
    });

    return NextResponse.json({
      success: true,
      accepted: true,
      sessionId: session.id,
      visitorName: session.visitorName,
      reply,
      intent: effectiveIntent,
    });
  } catch (error) {
    log.api.error("Public chatbot session POST failed", {
      route: "/api/public/chatbot/session",
    }, error);
    return NextResponse.json(
      { error: "Chatbericht verzenden mislukt." },
      { status: 500 }
    );
  }
}
