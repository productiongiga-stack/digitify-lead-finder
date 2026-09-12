import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@digitify/db";
import type { SendResult } from "@digitify/email";
import { log } from "./logger";

const leadSelection = {
  id: true, companyName: true, createdById: true, doNotContact: true, status: true,
} as const;

async function loadDraft(db: PrismaClient, id: string, workspaceId: string) {
  return db.emailDraft.findFirst({
    where: { id, lead: { createdById: workspaceId } },
    include: { lead: { select: leadSelection } },
  });
}

export type ApprovedSendDraft = NonNullable<Awaited<ReturnType<typeof loadDraft>>>;

/** A committed compare-and-swap claim is shared by interactive and scheduled sending. */
export async function sendApprovedDraft(
  db: PrismaClient,
  id: string,
  workspaceId: string,
  send: (draft: ApprovedSendDraft) => Promise<SendResult>,
  options: { drip?: boolean } = {},
) {
  const draft = await loadDraft(db, id, workspaceId);
  if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "E-mail niet gevonden." });
  if (!["APPROVED", "FAILED"].includes(draft.status) || !draft.approvedAt || !draft.approverId || draft.sentAt) {
    throw new TRPCError({ code: "CONFLICT", message: "Deze e-mail is niet klaar voor verzending of wordt al verwerkt." });
  }
  const prospecting = ["LEAD_CONTACT", "FOLLOW_UP", "REVIEW_REQUEST"].includes(draft.type);
  if (prospecting && draft.lead?.doNotContact) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Deze lead mag niet worden gecontacteerd." });
  }
  if (options.drip) {
    const replied = draft.sequenceId && await db.emailDraft.findFirst({
      where: { leadId: draft.leadId, sequenceId: draft.sequenceId, repliedAt: { not: null } },
      select: { id: true },
    });
    if (replied || ["RESPONDED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST", "ARCHIVED"].includes(draft.lead?.status ?? "")) {
      throw new TRPCError({ code: "CONFLICT", message: "Opvolging gestopt vanwege de reactie of status van deze lead." });
    }
  }
  const claimed = await db.emailDraft.updateMany({
    where: {
      id, status: draft.status, updatedAt: draft.updatedAt, sentAt: null,
      approvedAt: draft.approvedAt, approverId: draft.approverId,
      lead: { createdById: workspaceId, ...(prospecting ? { doNotContact: false } : {}) },
    },
    data: { status: "SENDING", rejectionNote: null },
  });
  if (claimed.count !== 1) throw new TRPCError({ code: "CONFLICT", message: "De e-mail is intussen gewijzigd of wordt al verzonden." });

  let result: SendResult;
  try {
    result = await send(draft);
  } catch (error) {
    log.email.error("Approved send outcome unknown", { draftId: id, workspaceId }, error);
    result = { success: false, delivery: "unknown" };
  }
  if (!result.success) {
    const message = result.delivery === "not_sent"
      ? "Verzenden mislukt voordat de mail werd aangeboden. Controleer de e-mailinstellingen."
      : "Aflevering onzeker. Controleer de verzonden berichten bij je mailprovider voordat je opnieuw contact opneemt.";
    await db.emailDraft.updateMany({
      where: { id, status: "SENDING", lead: { createdById: workspaceId } },
      data: { status: result.delivery === "not_sent" ? "FAILED" : "DELIVERY_UNKNOWN", rejectionNote: message },
    });
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  }

  // Never turn an accepted email back into FAILED when bookkeeping fails.
  try {
    const finalized = await db.emailDraft.updateMany({
      where: { id, status: "SENDING", lead: { createdById: workspaceId } },
      data: { status: "SENT", sentAt: new Date(), messageId: result.messageId, rejectionNote: null },
    });
    if (finalized.count !== 1) throw new Error("Email draft was changed while finalizing delivery");
    return db.emailDraft.findFirst({
      where: { id, lead: { createdById: workspaceId } },
      include: { lead: { select: leadSelection } },
    });
  } catch (error) {
    log.email.error("Email accepted; persistence requires reconciliation", { draftId: id, workspaceId, messageId: result.messageId }, error);
    await db.emailDraft.updateMany({
      where: { id, status: "SENDING", lead: { createdById: workspaceId } },
      data: { status: "DELIVERY_UNKNOWN", messageId: result.messageId, rejectionNote: "Mail geaccepteerd; verzendregistratie vereist controle." },
    }).catch(() => undefined);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "De mailprovider heeft de mail geaccepteerd. De registratie vereist controle; verzend niet opnieuw." });
  }
}
