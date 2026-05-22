import type { PrismaClient } from "@digitify/db";
import { emailTemplateDataFromInput } from "./email-templates";

export type StarterTemplateType =
  | "OUTREACH"
  | "FOLLOW_UP"
  | "PROPOSAL"
  | "REPORT"
  | "BOOKING"
  | "REVIEW"
  | "REENGAGEMENT"
  | "CUSTOM";

export type StarterTemplateLayout = "modern" | "minimal" | "business" | "proposal" | "followup";

export type EmailTemplateStarterItem = {
  name: string;
  type: StarterTemplateType;
  subject: string;
  body: string;
  layout: StarterTemplateLayout;
  description: string;
  ctaText?: string;
  ctaUrl?: string;
  /** When true, template is visible for every campaign filter in outbound. */
  isGlobal?: boolean;
};

/** Canonical starter pack — single source for Template Studio seed + deprecated contact seed. */
export const EMAIL_TEMPLATE_STARTER_PACK: EmailTemplateStarterItem[] = [
  {
    name: "Intro — Modern outreach",
    type: "OUTREACH",
    description: "Warme eerste kennismaking",
    subject: "Korte intro voor {{companyName}}",
    layout: "modern",
    ctaText: "Plan een gesprek",
    ctaUrl: "{{bookingLink}}",
    isGlobal: true,
    body: "Beste {{contactName}},\n\nIk zag dat {{companyName}} actief is in {{industry}}.\n\nHeb je 10 minuten deze week?\n\n{{senderName}}",
  },
  {
    name: "Follow-up — Compact",
    type: "FOLLOW_UP",
    description: "Korte opvolging",
    subject: "Even opvolgen — {{companyName}}",
    layout: "followup",
    isGlobal: true,
    body: "Beste {{contactName}},\n\nIk volg kort op op mijn vorige bericht.\n\n{{senderName}}",
  },
  {
    name: "Offerte — Proposal",
    type: "PROPOSAL",
    description: "Offerte met CTA",
    subject: "Offerte {{quoteNumber}} voor {{companyName}}",
    layout: "proposal",
    ctaText: "Bekijk offerte",
    ctaUrl: "{{quoteLink}}",
    isGlobal: true,
    body: "Beste {{contactName}},\n\nHierbij uw offerte. Totaal: {{offerPrice}}.\n\n{{senderName}}",
  },
  {
    name: "Rapport — Business",
    type: "REPORT",
    description: "Rapport delen",
    subject: "Uw rapport — {{companyName}}",
    layout: "business",
    ctaText: "Open rapport",
    ctaUrl: "{{reportLink}}",
    isGlobal: true,
    body: "Beste {{contactName}},\n\nIn bijlage vindt u het rapport voor {{companyName}}.\n\n{{senderName}}",
  },
  {
    name: "Afspraak — Bevestiging",
    type: "BOOKING",
    description: "Afspraak bevestigen",
    subject: "Bevestiging afspraak",
    layout: "business",
    isGlobal: true,
    body: "Beste {{contactName}},\n\nUw afspraak is bevestigd.\n\n{{senderName}}",
  },
  {
    name: "Review — Minimal",
    type: "REVIEW",
    description: "Feedback vragen",
    subject: "Korte feedbackvraag",
    layout: "minimal",
    ctaText: "Geef feedback",
    ctaUrl: "{{reviewLink}}",
    isGlobal: true,
    body: "Beste {{contactName}},\n\nHeb je 1 minuut voor feedback?\n\n{{senderName}}",
  },
  {
    name: "Heractivatie — Win-back",
    type: "REENGAGEMENT",
    description: "Inactieve lead",
    subject: "Nog interesse voor {{companyName}}?",
    layout: "followup",
    ctaText: "Plan een call",
    ctaUrl: "{{bookingLink}}",
    body: "Beste {{contactName}},\n\nIs timing nu beter voor een korte update?\n\n{{senderName}}",
  },
  {
    name: "Custom — Leeg canvas",
    type: "CUSTOM",
    description: "Eigen unieke flow",
    subject: "Onderwerp voor {{companyName}}",
    layout: "modern",
    body: "Beste {{contactName}},\n\nUw boodschap hier.\n\n{{senderName}}",
  },
];

export async function seedEmailTemplateStarterPack(
  db: PrismaClient,
  workspaceId: string,
): Promise<{ created: number; total: number }> {
  const existing = await db.emailTemplate.findMany({
    where: {
      createdById: workspaceId,
      OR: EMAIL_TEMPLATE_STARTER_PACK.map((item) => ({ name: item.name })),
    },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((item) => item.name));
  const toCreate = EMAIL_TEMPLATE_STARTER_PACK.filter((item) => !existingNames.has(item.name));

  if (toCreate.length === 0) {
    return { created: 0, total: EMAIL_TEMPLATE_STARTER_PACK.length };
  }

  await db.emailTemplate.createMany({
    data: toCreate.map((item) => ({
      createdById: workspaceId,
      name: item.name,
      subject: item.subject,
      isGlobal: item.isGlobal ?? false,
      ...emailTemplateDataFromInput({
        body: item.body,
        layout: item.layout,
        type: item.type,
        description: item.description,
        ctaText: item.ctaText,
        ctaUrl: item.ctaUrl,
      }),
    })),
  });

  return { created: toCreate.length, total: EMAIL_TEMPLATE_STARTER_PACK.length };
}
