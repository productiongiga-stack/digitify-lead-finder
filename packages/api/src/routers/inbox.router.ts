import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { Prisma } from "@digitify/db";
import { normalizeTlsOptions } from "../lib/email-utils";
import { buildLeadContext, generateBrandedHtml, replacePlaceholders, type EmailLayout } from "@digitify/email";
import { loadEmailSettings } from "../lib/email-sender";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "../lib/settings";
import { ensureLeadLink } from "../lib/lead-link";
import { extractEmailTemplateMetadata } from "../lib/email-content";

/* ---------- helpers ---------- */

type SettingRow = { key: string; value: unknown };

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

async function assertNotDuplicateSend(
  db: any,
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

async function getImapConfig(db: { setting: { findMany: () => Promise<SettingRow[]> } }) {
  const rows = await db.setting.findMany();
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

async function getSmtpConfig(db: { setting: { findMany: () => Promise<SettingRow[]> } }) {
  const rows = await db.setting.findMany();
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
  db: any;
  userId: string;
  input: {
    to: string;
    subject: string;
    body: string;
    type: "quote" | "lead_contact" | "reply" | "follow_up" | "general" | "booking_confirmation";
    leadId: string;
    inReplyTo?: string;
    references?: string;
  };
}) {
  const smtpConfig = await getSmtpConfig(params.db);
  const imapConfig = await getImapConfig(params.db);
  const emailSettings = await loadEmailSettings(params.db);

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
  const linkedLead = await ensureLeadLink({
    db: params.db,
    userId: params.userId,
    leadId: params.input.leadId,
    email: params.input.to,
    source: "inbox_send",
  });
  if (!linkedLead || linkedLead.id !== params.input.leadId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Verzenden vereist een geldige lead-koppeling.",
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
  const plainBody = [
    templateMetadata.cleanBody,
    emailSettings.signature.trim() ? emailSettings.signature.trim() : "",
    emailSettings.footer.trim() ? emailSettings.footer.trim() : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const htmlBody = generateBrandedHtml({
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

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    tls: smtpConfig.tls,
  });

  const info = await transporter.sendMail({
    from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
    to: params.input.to,
    subject,
    html: htmlBody,
    text: plainBody,
    replyTo: emailSettings.replyTo || undefined,
    bcc: emailSettings.bcc || undefined,
    inReplyTo: params.input.inReplyTo || undefined,
    references: params.input.references || undefined,
  });

  if (!info.messageId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "E-mail kon niet worden verzonden",
    });
  }

  try {
    await appendToSentMailbox(imapConfig, {
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: params.input.to,
      subject,
      html: htmlBody,
      messageId: info.messageId,
      inReplyTo: params.input.inReplyTo,
      references: params.input.references,
    });
  } catch {
    // E-mail is al verstuurd; IMAP append is best effort.
  }

  await params.db.activity.create({
    data: {
      leadId: linkedLead?.id || null,
      userId: params.userId,
      type: "EMAIL_SENT",
      title: `Inbox e-mail verzonden naar ${params.input.to}`,
      metadata: {
        channel: "inbox",
        kind: params.input.type,
        messageId: info.messageId,
        to: params.input.to,
        sendGuardKey: guardKey,
      },
    },
  });

  return { success: true, status: "sent" as const, messageId: info.messageId };
}

/* ---------- router ---------- */

export const inboxRouter = router({
  mailboxes: protectedProcedure.query(async ({ ctx }) => {
    const config = await getImapConfig(ctx.db as any);

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
      const config = await getImapConfig(ctx.db as any);
      const mailbox = input?.mailbox || "INBOX";

      return withImap(config, async (client) => {
        const lock = await client.getMailboxLock(mailbox);
        try {
          const messages: Array<{
            uid: number;
            from: string;
            to: string;
            subject: string;
            date: string;
            seen: boolean;
            messageId: string;
            inReplyTo: string;
            mailbox: string;
          }> = [];

          // Fetch last 50 messages by sequence number (newest first)
          const mb = client.mailbox;
          const totalMessages =
            mb && typeof mb === "object" && "exists" in mb ? (mb as { exists: number }).exists : 0;
          if (totalMessages === 0) return messages;

          const startSeq = Math.max(1, totalMessages - 49);
          const range = `${startSeq}:*`;

          for await (const msg of client.fetch(range, {
            uid: true,
            envelope: true,
            flags: true,
          })) {
            const envelope = msg.envelope;
            if (!envelope) continue;
            messages.push({
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
          messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return messages;
        } finally {
          lock.release();
        }
    });
  }),

  /**
   * Get full email by UID (including HTML body)
   */
  getMessage: protectedProcedure
    .input(z.object({ uid: z.number(), mailbox: z.string().default("INBOX") }))
    .query(async ({ ctx, input }) => {
      const config = await getImapConfig(ctx.db as any);

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

          return {
            uid: msg.uid,
            from: envelope.from?.[0]
              ? `${envelope.from[0].name || ""} <${envelope.from[0].address || ""}>`.trim()
              : "",
            fromAddress: envelope.from?.[0]?.address || "",
            to: envelope.to?.[0]
              ? `${envelope.to[0].name || ""} <${envelope.to[0].address || ""}>`.trim()
              : "",
            subject: envelope.subject || "(geen onderwerp)",
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

  send: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        type: z.enum(["quote", "lead_contact", "reply", "follow_up", "general", "booking_confirmation"]).default("general"),
        leadId: z.string().min(1),
        inReplyTo: z.string().optional(),
        references: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => sendInboxMessage({ db: ctx.db, userId: ctx.user.id, input })),

  /**
   * Reply to an email - sends via SMTP, appends to IMAP Sent folder
   */
  reply: protectedProcedure
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
      const linkedLead = await ensureLeadLink({
        db: ctx.db,
        userId: ctx.user.id,
        leadId: input.leadId,
        email: input.to,
        source: "inbox_reply",
      });
      if (!linkedLead) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Geen lead-koppeling gevonden voor dit antwoord.",
        });
      }
      return sendInboxMessage({
        db: ctx.db,
        userId: ctx.user.id,
        input: {
          to: input.to,
          subject: replySubject,
          body: input.body,
          type: "reply",
          leadId: linkedLead.id,
          inReplyTo: input.inReplyTo || input.messageId,
          references: [input.inReplyTo, input.messageId].filter(Boolean).join(" "),
        },
      });
    }),
});

/* ---------- MIME helpers ---------- */

function extractHtmlFromRaw(raw: string): string {
  // Look for text/html content in MIME parts
  const htmlMatch = raw.match(
    /Content-Type:\s*text\/html[^\r\n]*\r?\n(?:Content-Transfer-Encoding:\s*[^\r\n]*\r?\n)?(?:[^\r\n]*\r?\n)*?\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i,
  );
  if (htmlMatch?.[1]) {
    const body = htmlMatch[1].trim();
    // Check for base64 encoding
    if (/Content-Transfer-Encoding:\s*base64/i.test(raw.slice(0, raw.indexOf(body)))) {
      try {
        return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
      } catch {
        return body;
      }
    }
    // Check for quoted-printable
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(raw.slice(0, raw.indexOf(body)))) {
      return decodeQuotedPrintable(body);
    }
    return body;
  }
  return "";
}

function extractTextFromRaw(raw: string): string {
  const textMatch = raw.match(
    /Content-Type:\s*text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:\s*[^\r\n]*\r?\n)?(?:[^\r\n]*\r?\n)*?\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i,
  );
  if (textMatch?.[1]) {
    const body = textMatch[1].trim();
    if (/Content-Transfer-Encoding:\s*base64/i.test(raw.slice(0, raw.indexOf(body)))) {
      try {
        return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
      } catch {
        return body;
      }
    }
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(raw.slice(0, raw.indexOf(body)))) {
      return decodeQuotedPrintable(body);
    }
    return body;
  }
  return "";
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

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
