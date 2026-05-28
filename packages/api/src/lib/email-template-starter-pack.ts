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
  bodyFormat?: "TEXT" | "HTML";
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
    body: [
      "Beste {{contactName}},",
      "",
      "Ik zag dat {{companyName}} actief is in {{industry}} en wou kort kennismaken.",
      "We helpen bedrijven in deze fase meestal met snellere leadopvolging en meer conversie uit bestaande traffic.",
      "",
      "Heb je deze week 10 minuten voor een korte intake?",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
  },
  {
    name: "Follow-up — Compact",
    type: "FOLLOW_UP",
    description: "Korte opvolging",
    subject: "Even opvolgen — {{companyName}}",
    layout: "followup",
    isGlobal: true,
    body: [
      "Beste {{contactName}},",
      "",
      "Ik volg kort op op mijn eerdere mail voor {{companyName}}.",
      "Als timing nu niet ideaal is, plan ik graag een moment dat beter past.",
      "",
      "Met 1 korte call kunnen we meteen bepalen of het relevant is.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
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
    body: [
      "Beste {{contactName}},",
      "",
      "Hierbij stuur ik de offerte voor {{companyName}} met referentie {{quoteNumber}}.",
      "De totale investering bedraagt {{offerPrice}}.",
      "",
      "Bekijk gerust de opbouw; ik licht de prioriteiten en timing graag toe in een korte call.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
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
    body: [
      "Beste {{contactName}},",
      "",
      "Hier is het rapport voor {{companyName}}.",
      "Je vindt de belangrijkste inzichten en concrete verbeterpunten in de samenvatting.",
      "",
      "Laat gerust weten welke prioriteit jij eerst wil oppakken.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
  },
  {
    name: "Afspraak — Bevestiging",
    type: "BOOKING",
    description: "Afspraak bevestigen",
    subject: "Bevestiging afspraak",
    layout: "business",
    isGlobal: true,
    body: [
      "Beste {{contactName}},",
      "",
      "Je afspraak is bevestigd.",
      "Ik stuur kort vooraf nog een reminder met de agenda, zodat we meteen kunnen starten.",
      "",
      "Tot dan!",
      "{{senderName}}",
    ].join("\n"),
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
    body: [
      "Beste {{contactName}},",
      "",
      "Mag ik je 1 minuut vragen voor een korte review?",
      "Jouw feedback helpt ons om de dienstverlening voor {{companyName}} nog beter af te stemmen.",
      "",
      "Alvast bedankt!",
      "{{senderName}}",
    ].join("\n"),
  },
  {
    name: "Heractivatie — Win-back",
    type: "REENGAGEMENT",
    description: "Inactieve lead",
    subject: "Nog interesse voor {{companyName}}?",
    layout: "followup",
    ctaText: "Plan een call",
    ctaUrl: "{{bookingLink}}",
    body: [
      "Beste {{contactName}},",
      "",
      "We hebben elkaar een tijd niet gesproken over {{companyName}}.",
      "Is dit een beter moment om opnieuw aan te sluiten met een korte update?",
      "",
      "Ik deel graag een compact voorstel dat past bij jullie huidige focus.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
  },
  {
    name: "Custom — Leeg canvas",
    type: "CUSTOM",
    description: "Eigen HTML-mail — plak je opmaak",
    subject: "Onderwerp voor {{companyName}}",
    layout: "modern",
    bodyFormat: "HTML",
    body: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#374151;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Beste {{contactName}},</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Plak hier je HTML-opmaak of pas deze template aan.</p>
      <p style="margin:0;font-size:16px;line-height:1.6;">{{senderName}}</p>
    </td></tr>
  </table>
</body>
</html>`,
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
        bodyFormat: item.bodyFormat,
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

export async function syncEmailTemplateStarterPack(
  db: PrismaClient,
  workspaceId: string,
): Promise<{ created: number; updated: number; total: number }> {
  let created = 0;
  let updated = 0;

  for (const item of EMAIL_TEMPLATE_STARTER_PACK) {
    const payload = {
      subject: item.subject,
      isGlobal: item.isGlobal ?? false,
      ...emailTemplateDataFromInput({
        body: item.body,
        bodyFormat: item.bodyFormat,
        layout: item.layout,
        type: item.type,
        description: item.description,
        ctaText: item.ctaText,
        ctaUrl: item.ctaUrl,
      }),
    };

    const existing = await db.emailTemplate.findFirst({
      where: {
        createdById: workspaceId,
        name: item.name,
      },
      select: { id: true },
    });

    if (!existing) {
      await db.emailTemplate.create({
        data: {
          createdById: workspaceId,
          name: item.name,
          ...payload,
        },
      });
      created += 1;
      continue;
    }

    await db.emailTemplate.update({
      where: { id: existing.id },
      data: payload,
    });
    updated += 1;
  }

  return { created, updated, total: EMAIL_TEMPLATE_STARTER_PACK.length };
}
