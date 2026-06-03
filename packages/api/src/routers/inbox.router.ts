import { z } from "zod";
import { router, protectedProcedure, aiRateLimitedProcedure, mutationProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { type PrismaClient, Prisma } from "@digitify/db";
import { normalizeTlsOptions } from "../lib/email-utils";
import { buildLeadContext, generateBrandedHtml, normalizeHtmlEmailDocument, replacePlaceholders, type EmailLayout } from "@digitify/email";
import { loadEmailSettings } from "../lib/email-sender";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "../lib/settings";
import { findLeadByEmailInWorkspace, resolveLeadForEmail, ensureLeadLink } from "../lib/lead-link";
import { extractEmailTemplateMetadata } from "../lib/email-content";
import { loadWorkspaceSettingRows, workspaceScopeFromUser, type WorkspaceScope } from "../lib/workspace-settings";
import { log } from "../lib/logger";
import { generateInboxAiMessage } from "../lib/inbox-ai-reply";
import { fetchInboxMessageForAi } from "../lib/inbox-message-fetch";
import { extractHtmlFromRaw, extractTextFromRaw } from "../lib/inbox-mime-body";
import {
  invalidateInboxListCacheForWorkspace,
  readInboxListCache,
  writeInboxListCache,
} from "../lib/inbox-cache";

type InboxListMessage = {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  seen: boolean;
  messageId: string;
  inReplyTo: string;
  mailbox: string;
};

/* ---------- helpers ---------- */

const recentSendGuards = new Map<string, number>();
const SEND_GUARD_WINDOW_MS = 60_000;

function createSendGuardKey(userId: string, to: string, subject: string, body: string, inReplyTo = "") {
  const payload = [userId, to.trim().toLowerCase(), subject.trim().toLowerCase(), body.trim(), inReplyTo.trim()].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function throwDuplicateConflict() {
  throw new TRPCError({
    code: "CONFLICT",
    message: "Deze e-mail lijkt net al verzonden. Wacht even en vernieuw de inbox.",
  });
}

function readPrismaErrorCode(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  if (error && typeof error === "object" && "code" in error) {
    const candidate = (error as { code?: unknown }).code;
    if (typeof candidate === "string") return candidate;
  }
  return "";
}

async function recordInboundFromOpenedMessage(
  db: PrismaClient,
  params: {
    userId: string;
    workspaceId: string;
    fromEmail: string;
    subject: string;
    messageId?: string;
    bodyPreview?: string;
    mailbox: string;
    uid: number;
  },
) {
  if (!params.fromEmail) {
    return { linked: false as const, lead: null };
  }

  const lead = await findLeadByEmailInWorkspace(db, params.workspaceId, params.fromEmail);
  if (!lead) {
    return { linked: false as const, lead: null };
  }

  if (params.messageId) {
    const existing = await db.activity.findFirst({
      where: {
        leadId: lead.id,
        type: "EMAIL_REPLIED",
        metadata: {
          path: ["messageId"],
          equals: params.messageId,
        },
      },
    });
    if (existing) {
      return {
        linked: true as const,
        lead: { id: lead.id, companyName: lead.companyName },
        duplicate: true,
      };
    }
  } else {
    const existingByUid = await db.activity.findFirst({
      where: {
        leadId: lead.id,
        type: "EMAIL_REPLIED",
        AND: [
          { metadata: { path: ["mailbox"], equals: params.mailbox } },
          { metadata: { path: ["uid"], equals: params.uid } },
        ],
      },
    });
    if (existingByUid) {
      return {
        linked: true as const,
        lead: { id: lead.id, companyName: lead.companyName },
        duplicate: true,
      };
    }
  }

  await db.activity.create({
    data: {
      leadId: lead.id,
      userId: params.userId,
      type: "EMAIL_REPLIED",
      title: `E-mail ontvangen: ${params.subject}`,
      metadata: {
        channel: "inbox",
        direction: "inbound",
        subject: params.subject,
        from: params.fromEmail,
        messageId: params.messageId || null,
        bodyPreview: params.bodyPreview?.slice(0, 280) || null,
        mailbox: params.mailbox,
        uid: params.uid,
      },
    },
  });

  return {
    linked: true as const,
    lead: { id: lead.id, companyName: lead.companyName },
    duplicate: false,
  };
}

async function assertNotDuplicateSend(
  db: PrismaClient,
  params: { userId: string; guardKey: string },
) {
  const now = Date.now();
  for (const [key, ts] of recentSendGuards.entries()) {
    if (now - ts > SEND_GUARD_WINDOW_MS) recentSendGuards.delete(key);
  }
  const hit = recentSendGuards.get(params.guardKey);
  if (hit && now - hit < SEND_GUARD_WINDOW_MS) {
    throwDuplicateConflict();
  }

  const scope = "inbox.send";
  const dbGuardKey = `${scope}:${params.userId}:${params.guardKey}`;
  const expiresAt = new Date(now + SEND_GUARD_WINDOW_MS);
  try {
    await db.idempotencyKey.create({
      data: {
        scope,
        key: dbGuardKey,
        expiresAt,
      },
    });
    await db.idempotencyKey.deleteMany({
      where: {
        scope,
        expiresAt: { lt: new Date(now - SEND_GUARD_WINDOW_MS) },
      },
    });
  } catch (error: unknown) {
    const code = readPrismaErrorCode(error);
    if (code === "P2002") {
      throwDuplicateConflict();
    }
    if (code !== "P2021") {
      throw error;
    }
  }

  const since = new Date(now - SEND_GUARD_WINDOW_MS);
  const recentActivities = await db.activity.findMany({
    where: {
      userId: params.userId,
      type: "EMAIL_SENT",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { metadata: true },
  });

  const duplicateInDb = recentActivities.some((item: { metadata: unknown }) => {
    if (!item?.metadata || typeof item.metadata !== "object") return false;
    const metadata = item.metadata as Record<string, unknown>;
    return metadata.sendGuardKey === params.guardKey;
  });

  if (duplicateInDb) {
    throwDuplicateConflict();
  }

  recentSendGuards.set(params.guardKey, now);
}

function resolveLayoutForType(type: string, fallback: EmailLayout): EmailLayout {
  switch (type) {
    case "quote":
      return "proposal";
    case "follow_up":
      return "followup";
    case "booking_confirmation":
      return "business";
    default:
      return fallback;
  }
}

function mapInboxTypeToEmailType(type: "quote" | "lead_contact" | "reply" | "follow_up" | "general" | "booking_confirmation") {
  switch (type) {
    case "quote":
      return "QUOTE" as const;
    case "lead_contact":
      return "LEAD_CONTACT" as const;
    case "reply":
      return "REPLY" as const;
    case "follow_up":
      return "FOLLOW_UP" as const;
    case "booking_confirmation":
    case "general":
      return "TRANSACTIONAL" as const;
    default:
      return "LEAD_CONTACT" as const;
  }
}

function resolveAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed).toString().replace(/\/$/, "");
    } catch {
      continue;
    }
  }
  return "http://localhost:3000";
}

async function getImapConfig(db: PrismaClient, scope: WorkspaceScope) {
  const rows = await loadWorkspaceSettingRows(db, scope);
  const settings = settingsRowsToMap(rows);
  const host = getSettingString(settings, "email.imap_host");
  const port = getSettingString(settings, "email.imap_port", "993");
  const user = getSettingString(settings, "email.imap_user");
  const pass = getSettingString(settings, "email.imap_pass");
  const tls = getSettingBoolean(settings, "email.imap_tls", true);
  const servername = getSettingString(settings, "email.smtp_servername");
  const rejectUnauthorized = getSettingBoolean(settings, "email.smtp_tls_reject_unauthorized", true);

  if (!host || !user || !pass) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "IMAP is niet geconfigureerd. Ga naar Instellingen > Integraties.",
    });
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: tls,
    auth: { user, pass },
    logger: false as const,
    tls: {
      rejectUnauthorized,
      ...(servername ? { servername } : {}),
    },
  };
}

async function getSmtpConfig(db: PrismaClient, scope: WorkspaceScope) {
  const rows = await loadWorkspaceSettingRows(db, scope);
  const settings = settingsRowsToMap(rows);
  const host = getSettingString(settings, "email.smtp_host");
  const port = getSettingString(settings, "email.smtp_port", "587");
  const user = getSettingString(settings, "email.smtp_user");
  const pass = getSettingString(settings, "email.smtp_pass");
  const servername = getSettingString(settings, "email.smtp_servername");
  const rejectUnauthorized = getSettingBoolean(settings, "email.smtp_tls_reject_unauthorized", true);

  if (!host || !user || !pass) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SMTP is niet geconfigureerd. Ga naar Instellingen > Integraties.",
    });
  }

  return {
    host,
    port: parseInt(port, 10),
    user,
    pass,
    tls: normalizeTlsOptions({
      host,
      explicitServername: servername,
      username: user,
      rejectUnauthorized,
    }),
  };
}

async function withImap<T>(
  config: Awaited<ReturnType<typeof getImapConfig>>,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow(config);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

async function appendToSentMailbox(
  imapConfig: Awaited<ReturnType<typeof getImapConfig>>,
  opts: { from: string; to: string; subject: string; html: string; messageId: string; inReplyTo?: string; references?: string; },
) {
  await withImap(imapConfig, async (client) => {
    const sentFolders = ["Sent", "INBOX.Sent", "[Gmail]/Sent Mail", "Sent Items", "Verzonden items"];
    const mailboxes = await client.list();
    const sentBox = mailboxes.find(
      (mb) =>
        mb.specialUse === "\\Sent" ||
        sentFolders.some((name) => mb.path.toLowerCase() === name.toLowerCase()),
    );

    if (!sentBox) return;
    const rawMessage = buildRawEmail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      messageId: opts.messageId,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
    });
    await client.append(sentBox.path, Buffer.from(rawMessage), ["\\Seen"]);
  });
}

async function sendInboxMessage(params: {
  db: PrismaClient;
  userId: string;
  workspaceScope: WorkspaceScope;
  input: {
    to: string;
    subject: string;
    body: string;
    type: "quote" | "lead_contact" | "reply" | "follow_up" | "general" | "booking_confirmation";
    leadId?: string;
    inReplyTo?: string;
    references?: string;
  };
}) {
  const scope = params.workspaceScope ?? {
    workspaceId: params.userId,
    memberId: params.userId,
  };
  const smtpConfig = await getSmtpConfig(params.db, scope);
  const imapConfig = await getImapConfig(params.db, scope);
  const emailSettings = await loadEmailSettings(params.db, scope);

  const guardKey = createSendGuardKey(
    params.userId,
    params.input.to,
    params.input.subject,
    params.input.body,
    params.input.inReplyTo,
  );
  await assertNotDuplicateSend(params.db, { userId: params.userId, guardKey });

  const fromEmail = emailSettings.fromEmail || smtpConfig.user;
  const fromName = emailSettings.fromName || emailSettings.companyName || smtpConfig.user;
  const workspaceId = scope.workspaceId;
  const requestedLeadId = params.input.leadId?.trim();
  let linkedLead = null as Awaited<ReturnType<typeof ensureLeadLink>>;

  if (requestedLeadId) {
    linkedLead = await ensureLeadLink({
      db: params.db,
      userId: workspaceId,
      workspaceId,
      leadId: requestedLeadId,
      email: params.input.to,
      source: params.input.type === "reply" ? "inbox_reply" : "inbox_send",
    });
    if (!linkedLead || linkedLead.id !== requestedLeadId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Gekozen lead kon niet worden gekoppeld.",
      });
    }
  } else {
    linkedLead = await resolveLeadForEmail(params.db, workspaceId, params.input.to, {
      createIfMissing: true,
      source: `inbox_${params.input.type}`,
    });
  }

  const placeholderContext = linkedLead
    ? buildLeadContext(
        {
          companyName: linkedLead.companyName || undefined,
          email: linkedLead.email || undefined,
          phone: linkedLead.phone || undefined,
          website: linkedLead.website || undefined,
          industry: linkedLead.industry || undefined,
          city: linkedLead.city || undefined,
          overallScore: linkedLead.overallScore ?? undefined,
          scorePriority: linkedLead.scorePriority || undefined,
          contacts: linkedLead.contacts || [],
        },
        {
          senderName: fromName,
          senderCompany: emailSettings.companyName || fromName,
          senderEmail: fromEmail,
        },
      )
    : {
        senderName: fromName,
        senderCompany: emailSettings.companyName || fromName,
        senderEmail: fromEmail,
      };

  const subject = replacePlaceholders(params.input.subject.trim(), placeholderContext, { removeMissing: true }).trim() || "Bericht";
  const resolvedBody = replacePlaceholders(params.input.body.trim(), placeholderContext, { removeMissing: true }).trim();
  const templateMetadata = extractEmailTemplateMetadata(resolvedBody);
  const isHtmlBody = templateMetadata.bodyFormat === "HTML";
  const plainBody = isHtmlBody
    ? templateMetadata.cleanBody
    : [
        templateMetadata.cleanBody,
        emailSettings.signature.trim() ? emailSettings.signature.trim() : "",
        emailSettings.footer.trim() ? emailSettings.footer.trim() : "",
      ]
        .filter(Boolean)
        .join("\n\n");
  const draft = await params.db.emailDraft.create({
    data: {
      leadId: linkedLead?.id ?? null,
      authorId: params.userId,
      toEmail: params.input.to,
      subject,
      body: resolvedBody,
      status: "SENDING",
      type: mapInboxTypeToEmailType(params.input.type),
    },
  });
  const trackingPixel = `<img src="${resolveAppUrl()}/api/public/email/open/${encodeURIComponent(draft.id)}" alt="" width="1" height="1" style="display:none;border:0;outline:none;"/>`;
  const htmlBody = isHtmlBody
    ? normalizeHtmlEmailDocument(plainBody)
    : generateBrandedHtml({
        subject,
        body: plainBody,
        companyName: emailSettings.companyName || fromName || "Digitify",
        primaryColor: emailSettings.primaryColor,
        fromName,
        fromEmail,
        headerSlogan: emailSettings.headerSlogan,
        recipientCompany: linkedLead?.companyName || params.input.to,
        logoUrl: emailSettings.logoUrl,
        hidePoweredBy: true,
        layout: templateMetadata.layout || resolveLayoutForType(params.input.type, emailSettings.defaultLayout),
        ctaText: templateMetadata.ctaText,
        ctaUrl: templateMetadata.ctaUrl,
        typographyMode: emailSettings.typographyMode,
      });
  const htmlBodyWithTracking = `${htmlBody}${trackingPixel}`;

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    tls: smtpConfig.tls,
  });

  let info: nodemailer.SentMessageInfo;
  try {
    info = await transporter.sendMail({
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: params.input.to,
      subject,
      html: htmlBodyWithTracking,
      text: plainBody,
      replyTo: emailSettings.replyTo || undefined,
      bcc: emailSettings.bcc || undefined,
      inReplyTo: params.input.inReplyTo || undefined,
      references: params.input.references || undefined,
    });

    if (!info.messageId) {
      throw new Error("Missing messageId");
    }
  } catch (error) {
    await params.db.emailDraft.update({
      where: { id: draft.id },
      data: {
        status: "FAILED",
        rejectionNote: error instanceof Error ? error.message : "E-mail kon niet worden verzonden",
      },
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "E-mail kon niet worden verzonden",
    });
  }

  await params.db.emailDraft.update({
    where: { id: draft.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      messageId: info.messageId,
      rejectionNote: null,
    },
  });

  try {
    await appendToSentMailbox(imapConfig, {
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: params.input.to,
      subject,
      html: htmlBodyWithTracking,
      messageId: info.messageId,
      inReplyTo: params.input.inReplyTo,
      references: params.input.references,
    });
  } catch (error) {
    log.email.warn("IMAP append to Sent failed", {
      userId: params.userId,
      leadId: linkedLead?.id ?? null,
      messageId: info.messageId,
    }, error);
  }

  await params.db.activity.create({
    data: {
      leadId: linkedLead?.id || null,
      userId: params.userId,
      type: "EMAIL_SENT",
      title: `E-mail verzonden: ${subject}`,
      metadata: {
        channel: "inbox",
        direction: "outbound",
        kind: params.input.type,
        subject,
        from: fromEmail,
        to: params.input.to,
        messageId: info.messageId,
        bodyPreview: plainBody.slice(0, 280),
        sendGuardKey: guardKey,
        draftId: draft.id,
      },
    },
  });

  return { success: true, status: "sent" as const, messageId: info.messageId };
}

/* ---------- router ---------- */

export const inboxRouter = router({
  mailboxes: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const config = await getImapConfig(ctx.db, scope);

    return withImap(config, async (client) => {
      const mailboxes = await client.list();
      const lowerCasePathMap = new Map(mailboxes.map((mailbox) => [mailbox.path.toLowerCase(), mailbox]));
      const sentNames = ["sent", "inbox.sent", "[gmail]/sent mail", "sent items", "verzonden items"];
      const trashNames = ["trash", "inbox.trash", "[gmail]/trash", "deleted items", "prullenbak"];
      const archiveNames = ["archive", "inbox.archive", "[gmail]/all mail", "all mail", "archief"];

      const pickMailbox = (
        fallbackPath: string,
        label: string,
        names: string[],
        specialUse: string
      ) => {
        const match =
          mailboxes.find((mailbox) => mailbox.specialUse === specialUse) ??
          names
            .map((name) => lowerCasePathMap.get(name))
            .find(Boolean);
        if (!match && fallbackPath !== "INBOX") return null;
        return {
          path: match?.path ?? fallbackPath,
          label,
        };
      };

      return [
        { path: "INBOX", label: "Inbox" },
        pickMailbox("Sent", "Verzonden", sentNames, "\\Sent"),
        pickMailbox("Trash", "Prullenbak", trashNames, "\\Trash"),
        pickMailbox("Archive", "Archief", archiveNames, "\\Archive"),
      ].filter((item): item is { path: string; label: string } => Boolean(item));
    });
  }),

  /**
   * Fetch last 50 emails from INBOX
   */
  list: protectedProcedure
    .input(z.object({ mailbox: z.string().default("INBOX") }).optional())
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const config = await getImapConfig(ctx.db, scope);
      const mailbox = input?.mailbox || "INBOX";
      const cacheKey = `inbox:list:${scope.workspaceId}:${mailbox}`;
      const cached = readInboxListCache<InboxListMessage[]>(cacheKey);
      if (cached) return cached;

      const messages = await withImap(config, async (client) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const items: InboxListMessage[] = [];

          // Fetch last 50 messages by sequence number (newest first)
          const mb = client.mailbox;
          const totalMessages =
            mb && typeof mb === "object" && "exists" in mb ? (mb as { exists: number }).exists : 0;
          if (totalMessages === 0) return items;

          const startSeq = Math.max(1, totalMessages - 49);
          const range = `${startSeq}:*`;

          for await (const msg of client.fetch(range, {
            uid: true,
            envelope: true,
            flags: true,
          })) {
            const envelope = msg.envelope;
            if (!envelope) continue;
            items.push({
              uid: msg.uid,
              from: envelope.from?.[0]
                ? `${envelope.from[0].name || ""} <${envelope.from[0].address || ""}>`.trim()
                : "",
              to: envelope.to?.[0]
                ? `${envelope.to[0].name || ""} <${envelope.to[0].address || ""}>`.trim()
                : "",
              subject: envelope.subject || "(geen onderwerp)",
              date: envelope.date?.toISOString() ?? new Date().toISOString(),
              seen: msg.flags?.has("\\Seen") ?? false,
              messageId: envelope.messageId || "",
              inReplyTo: envelope.inReplyTo || "",
              mailbox,
            });
          }

          // Sort newest first
          items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return items;
        } finally {
          lock.release();
        }
      });

      writeInboxListCache(cacheKey, messages);
      return messages;
    }),

  /**
   * Get full email by UID (including HTML body)
   */
  getMessage: protectedProcedure
    .input(z.object({ uid: z.number(), mailbox: z.string().default("INBOX") }))
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
    const config = await getImapConfig(ctx.db, scope);

      return withImap(config, async (client) => {
        const lock = await client.getMailboxLock(input.mailbox);
        try {
          const msg = await client.fetchOne(String(input.uid), {
            uid: true,
            envelope: true,
            source: true,
            flags: true,
          }, { uid: true });

          if (!msg) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Bericht niet gevonden" });
          }

          // Parse the raw source to extract HTML body
          const raw = msg.source?.toString("utf-8") ?? "";
          const html = extractHtmlFromRaw(raw);
          const text = extractTextFromRaw(raw);
          const envelope = msg.envelope;
          if (!envelope) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Bericht envelope niet gevonden" });
          }

          // Mark as seen
          await client.messageFlagsAdd(String(input.uid), ["\\Seen"], { uid: true }).catch(() => {});

          const fromAddress = envelope.from?.[0]?.address || "";
          const subject = envelope.subject || "(geen onderwerp)";
          const messageId = envelope.messageId || undefined;
          const bodyPreview = (text || html).slice(0, 280);

          await recordInboundFromOpenedMessage(ctx.db, {
            userId: ctx.user.id,
            workspaceId: ctx.user.workspaceId!,
            fromEmail: fromAddress,
            subject,
            messageId,
            bodyPreview,
            mailbox: input.mailbox,
            uid: msg.uid,
          }).catch((error) => {
            log.email.warn("Inbound activity record failed", {
              userId: ctx.user.id,
              uid: msg.uid,
              mailbox: input.mailbox,
            }, error);
          });

          return {
            uid: msg.uid,
            from: envelope.from?.[0]
              ? `${envelope.from[0].name || ""} <${envelope.from[0].address || ""}>`.trim()
              : "",
            fromAddress,
            to: envelope.to?.[0]
              ? `${envelope.to[0].name || ""} <${envelope.to[0].address || ""}>`.trim()
              : "",
            subject,
            date: envelope.date?.toISOString() ?? new Date().toISOString(),
            seen: msg.flags?.has("\\Seen") ?? true,
            messageId: envelope.messageId || "",
            inReplyTo: envelope.inReplyTo || "",
            html,
            text,
            mailbox: input.mailbox,
          };
        } finally {
          lock.release();
        }
      });
    }),

  send: mutationProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        type: z.enum(["quote", "lead_contact", "reply", "follow_up", "general", "booking_confirmation"]).default("general"),
        leadId: z.string().optional(),
        inReplyTo: z.string().optional(),
        references: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await sendInboxMessage({
        db: ctx.db,
        userId: ctx.user.id,
        workspaceScope: workspaceScopeFromUser(ctx.user),
        input: {
          ...input,
          leadId: input.leadId?.trim() || undefined,
        },
      });
      invalidateInboxListCacheForWorkspace(ctx.user.workspaceId!);
      return result;
    }),

  /**
   * Reply to an email - sends via SMTP, appends to IMAP Sent folder
   */
  reply: mutationProcedure
    .input(
      z.object({
        uid: z.number(),
        to: z.string().email(),
        subject: z.string(),
        messageId: z.string(),
        inReplyTo: z.string(),
        body: z.string().min(1),
        leadId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const replySubject = input.subject.startsWith("Re:") ? input.subject : `Re: ${input.subject}`;
      const result = await sendInboxMessage({
        db: ctx.db,
        userId: ctx.user.id,
        workspaceScope: workspaceScopeFromUser(ctx.user),
        input: {
          to: input.to,
          subject: replySubject,
          body: input.body,
          type: "reply",
          leadId: input.leadId?.trim() || undefined,
          inReplyTo: input.inReplyTo || input.messageId,
          references: [input.inReplyTo, input.messageId].filter(Boolean).join(" "),
        },
      });
      invalidateInboxListCacheForWorkspace(ctx.user.workspaceId!);
      return result;
    }),

  resolveLeadByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const lead = await findLeadByEmailInWorkspace(ctx.db, workspaceId, input.email);
      if (!lead) return null;
      return {
        id: lead.id,
        companyName: lead.companyName,
        email: lead.email,
        status: lead.status,
      };
    }),

  suggestReply: aiRateLimitedProcedure
    .input(
      z.object({
        uid: z.number(),
        mailbox: z.string().default("INBOX"),
        style: z.string(),
        draftBody: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const fetched = await fetchInboxMessageForAi(ctx.db, scope, {
        uid: input.uid,
        mailbox: input.mailbox,
      });
      const replySubject = fetched.subject.startsWith("Re:") ? fetched.subject : `Re: ${fetched.subject}`;
      return generateInboxAiMessage(ctx.db, ctx.user.workspaceId!, {
        purpose: "reply",
        style: input.style,
        draftBody: input.draftBody,
        subject: replySubject,
        incomingSubject: fetched.subject,
        incomingBody: fetched.text,
        incomingHtml: fetched.html,
        recipientEmail: fetched.fromAddress,
        recipientName: fetched.fromName,
      });
    }),
});

function buildRawEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const boundary = `----=_Part_${Date.now()}`;
  return [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Message-ID: ${opts.messageId}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Date: ${new Date().toUTCString()}`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");
}
