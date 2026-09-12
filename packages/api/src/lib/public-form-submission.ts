import type { PrismaClient } from "@digitify/db";
import { importLeadRecords } from "./lead-import";

type PublicFormSubmissionInput = {
  formId: string;
  formPublicKey: string;
  workspaceId: string;
  fingerprint: string;
  data: Record<string, string>;
};

/**
 * Serializes the complete public-form operation so a concurrent request cannot
 * create an extra lead before its duplicate submission is detected.
 */
export async function createPublicFormSubmission(
  db: PrismaClient,
  input: PublicFormSubmissionInput,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`form-submission:${input.formId}:${input.fingerprint}`}, 0))`;

    const existing = await tx.formSubmission.findUnique({
      where: { formId_fingerprint: { formId: input.formId, fingerprint: input.fingerprint } },
      select: { id: true },
    });
    if (existing) return null;

    const imported = await importLeadRecords(db, input.workspaceId, [{
      createdById: input.workspaceId,
      companyName: input.data.company || input.data.name,
      email: input.data.email || null,
      phone: input.data.phone || null,
      source: "lead_form",
      sourceQuery: input.formPublicKey,
      address: null,
      city: null,
      country: null,
      status: "NEW",
    }]);
    const lead = imported.created[0] ?? (imported.duplicates[0] ? { id: imported.duplicates[0] } : null);
    if (!lead) throw new Error("FORM_SUBMISSION_LEAD_FAILED");

    return tx.formSubmission.create({
      data: { formId: input.formId, leadId: lead.id, fingerprint: input.fingerprint, data: input.data },
    });
  });
}
