import { TRPCError } from "@trpc/server";
import { ImapFlow } from "imapflow";
import { type PrismaClient } from "@digitify/db";
import { emailBodyForAi, extractHtmlFromRaw, extractTextFromRaw } from "./inbox-mime-body";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows, type WorkspaceScope } from "./workspace-settings";

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

export async function fetchInboxMessageForAi(
  db: PrismaClient,
  scope: WorkspaceScope,
  input: { uid: number; mailbox: string },
) {
  const config = await getImapConfig(db, scope);
  const client = new ImapFlow(config);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(input.mailbox);
    try {
      const msg = await client.fetchOne(
        String(input.uid),
        { uid: true, envelope: true, source: true },
        { uid: true },
      );
      if (!msg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bericht niet gevonden" });
      }
      const envelope = msg.envelope;
      if (!envelope) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bericht envelope niet gevonden" });
      }
      const raw = msg.source?.toString("utf-8") ?? "";
      const html = extractHtmlFromRaw(raw);
      const text = extractTextFromRaw(raw);
      const body = emailBodyForAi({ text, html, raw });
      const from = envelope.from?.[0];
      return {
        subject: envelope.subject || "(geen onderwerp)",
        fromAddress: from?.address || "",
        fromName: from?.name || "",
        body,
        html,
        text,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
