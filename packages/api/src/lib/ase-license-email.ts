import type { PrismaClient } from "@digitify/db";
import { createEmailProvider } from "@digitify/email";
import { sendBrandedEmail } from "./email-sender";

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

export function buildLicenseEmailBody(params: { name?: string | null; key: string }) {
  const recipient = params.name?.trim() || "daar";
  const base = appUrl();
  return [
    `Hallo ${recipient},`,
    "",
    "Hier is je license key voor de Digitify AI Builder (AI Site Editor):",
    "",
    params.key,
    "",
    "Activatie:",
    "1. Open WordPress → Digitify AI Webbuilder → Settings",
    "2. Plak de key en klik op Activeren",
    "3. Zonder geldige key blijft de builder open, maar kun je niets bewerken of AI gebruiken",
    "",
    `Meer info: ${base}/ase-license`,
    "",
    "Digitify",
  ].join("\n");
}

function envProvider() {
  return (process.env.EMAIL_PROVIDER || "").toLowerCase();
}

function allowConsoleFallback() {
  if (envProvider() === "console") return true;
  return process.env.NODE_ENV !== "production";
}

async function sendViaConsole(params: {
  toEmail: string;
  subject: string;
  body: string;
}) {
  const from =
    process.env.SMTP_USER?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "noreply@digitify.be";
  const provider = createEmailProvider({ provider: "console" });
  return provider.send({
    from,
    fromName: "Digitify",
    to: params.toEmail,
    subject: params.subject,
    text: params.body,
    html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${params.body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>`,
  });
}

async function sendOperationalEmail(
  db: PrismaClient,
  params: {
    toEmail: string;
    subject: string;
    body: string;
    userId: string;
  },
) {
  if (envProvider() === "console") {
    return sendViaConsole(params);
  }

  const branded = await sendBrandedEmail(db, {
    toEmail: params.toEmail,
    subject: params.subject,
    body: params.body,
    userId: params.userId,
  });
  if (branded.success) return branded;

  if (!allowConsoleFallback()) return branded;
  return sendViaConsole(params);
}

/**
 * Send license key via workspace branded email.
 * With EMAIL_PROVIDER=console, skips SMTP entirely (avoids local timeouts).
 */
export async function sendLicenseKeyEmail(
  db: PrismaClient,
  params: {
    toEmail: string;
    name?: string | null;
    key: string;
    userId: string;
  },
) {
  const subject = "Je Digitify AI Builder license key";
  const body = buildLicenseEmailBody(params);
  const result = await sendOperationalEmail(db, {
    toEmail: params.toEmail,
    subject,
    body,
    userId: params.userId,
  });
  if (result.success) {
    return { success: true as const, messageId: result.messageId };
  }
  return {
    success: false as const,
    error: ("error" in result ? result.error : null) || "Mail niet verzonden",
  };
}

/** Notify Digitify owners that a new public license request arrived. */
export async function notifyOwnersOfLicenseRequest(
  db: PrismaClient,
  request: {
    id: string;
    email: string;
    name?: string | null;
    siteUrl?: string | null;
    message?: string | null;
  },
) {
  const base = appUrl();
  const workspaceId =
    process.env.REGISTRATION_NOTIFY_WORKSPACE_ID?.trim() ||
    process.env.PUBLIC_MARKETING_WORKSPACE_ID?.trim() ||
    "";

  const owners = workspaceId
    ? await db.user.findMany({
        where: {
          role: "OWNER",
          OR: [{ id: workspaceId }, { workspaceOwnerId: workspaceId }],
          email: { not: "" },
        },
        select: { id: true, email: true },
        take: 10,
      })
    : await db.user.findMany({
        where: { role: "OWNER", email: { not: "" } },
        select: { id: true, email: true },
        take: 10,
      });

  if (!owners.length) return { notified: 0 };

  const subject = "Nieuwe AI Builder license-aanvraag";
  const body = [
    "Er is een nieuwe license-aanvraag voor de Digitify AI Builder:",
    "",
    `Naam: ${request.name || "—"}`,
    `E-mail: ${request.email}`,
    `Site: ${request.siteUrl || "—"}`,
    request.message ? `Bericht: ${request.message}` : null,
    "",
    `Beheer: ${base}/settings/ase-licenses`,
    "",
    "Digitify",
  ]
    .filter(Boolean)
    .join("\n");

  const results = await Promise.allSettled(
    owners.map((owner) =>
      sendOperationalEmail(db, {
        toEmail: owner.email,
        subject,
        body,
        userId: workspaceId || owner.id,
      }),
    ),
  );

  const notified = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
  return { notified };
}
