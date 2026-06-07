import type { PrismaClient } from "@digitify/db";

export type EmailModuleKey =
  | "LEADS"
  | "CAMPAIGNS"
  | "QUOTES"
  | "INVOICES"
  | "BOOKINGS"
  | "REVIEWS"
  | "AUTH"
  | "INBOX"
  | "SYSTEM";
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
  module?: EmailModuleKey;
  templateKey?: string;
  isSystem?: boolean;
  /** When true, template is visible for every campaign filter in outbound. */
  isGlobal?: boolean;
};

export type SystemEmailTemplateDef = {
  templateKey: string;
  module: EmailModuleKey;
  name: string;
  type: StarterTemplateType;
  subject: string;
  body: string;
  bodyFormat?: "TEXT" | "HTML";
  layout?: StarterTemplateLayout;
  description: string;
  ctaText?: string;
  ctaUrl?: string;
  isSystem: boolean;
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

/** System templates keyed by templateKey — used by transactional routers and sendTemplatedEmail. */
export const EMAIL_SYSTEM_TEMPLATES: SystemEmailTemplateDef[] = [
  {
    templateKey: "booking.pending",
    module: "BOOKINGS",
    name: "Afspraak — Ontvangen",
    type: "BOOKING",
    description: "Klant: boeking ontvangen",
    subject: "Boeking ontvangen bij {{senderCompany}}",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "Bedankt voor uw aanvraag. We hebben uw boeking ontvangen.",
      "{{bookingDetails}}",
      "",
      "We bevestigen uw afspraak zo snel mogelijk.",
      "",
      "Zelf aanpassen of annuleren: {{manageUrl}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "booking.confirmed",
    module: "BOOKINGS",
    name: "Afspraak — Bevestigd",
    type: "BOOKING",
    description: "Klant: afspraak bevestigd",
    subject: "Uw afspraak is bevestigd",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "Uw afspraak bij {{senderCompany}} is bevestigd.",
      "{{bookingDetails}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "booking.updated",
    module: "BOOKINGS",
    name: "Afspraak — Bijgewerkt",
    type: "BOOKING",
    description: "Klant: afspraak gewijzigd",
    subject: "Update van uw afspraak bij {{senderCompany}}",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "Uw afspraakgegevens werden aangepast. Hieronder vindt u de nieuwste planning.",
      "{{bookingDetails}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "booking.cancelled",
    module: "BOOKINGS",
    name: "Afspraak — Afgewezen",
    type: "BOOKING",
    description: "Klant: boeking afgewezen",
    subject: "Update over uw booking aanvraag",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "Uw booking aanvraag bij {{senderCompany}} kon momenteel niet bevestigd worden.{{rejectionReason}}",
      "{{bookingDetails}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "booking.reminder_24h",
    module: "BOOKINGS",
    name: "Afspraak — Herinnering 24u",
    type: "BOOKING",
    description: "Herinnering 24 uur vooraf",
    subject: "Herinnering: afspraak morgen bij {{senderCompany}}",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "Dit is een vriendelijke herinnering voor uw afspraak morgen.",
      "{{bookingDetails}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "booking.reminder_1h",
    module: "BOOKINGS",
    name: "Afspraak — Herinnering 1u",
    type: "BOOKING",
    description: "Herinnering 1 uur vooraf",
    subject: "Herinnering: afspraak over 1 uur",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "Uw afspraak start over ongeveer 1 uur.",
      "{{bookingDetails}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "booking.admin_notify",
    module: "BOOKINGS",
    name: "Afspraak — Admin notificatie",
    type: "BOOKING",
    description: "Interne notificatie voor team",
    subject: "{{adminSubject}}",
    layout: "business",
    body: [
      "{{adminIntro}}",
      "",
      "Klant: {{contactName}}",
      "E-mail: {{clientEmail}}",
      "{{bookingDetails}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "auth.verify_email",
    module: "AUTH",
    name: "Auth — E-mail verifiëren",
    type: "CUSTOM",
    description: "Registratie e-mailverificatie",
    subject: "Verifieer je toegang tot Digitify Lead Finder",
    layout: "minimal",
    body: [
      "Hallo {{contactName}},",
      "",
      "Bedankt voor je registratieaanvraag voor Digitify Lead Finder.",
      "",
      "Bevestig je e-mailadres via deze link:",
      "{{verifyUrl}}",
      "",
      "Daarna kan een admin je aanvraag goedkeuren.",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "auth.approved",
    module: "AUTH",
    name: "Auth — Toegang goedgekeurd",
    type: "CUSTOM",
    description: "Registratie goedgekeurd",
    subject: "Je toegang tot Digitify Lead Finder is goedgekeurd",
    layout: "minimal",
    body: [
      "Hallo {{contactName}},",
      "",
      "Je aanvraag is goedgekeurd. Je start in je eigen persoonlijke workspace.",
      "",
      "Login: {{loginUrl}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "auth.rejected",
    module: "AUTH",
    name: "Auth — Aanvraag afgewezen",
    type: "CUSTOM",
    description: "Registratie afgewezen",
    subject: "Je aanvraag voor Digitify Lead Finder",
    layout: "minimal",
    body: [
      "Hallo {{contactName}},",
      "",
      "Je aanvraag werd niet goedgekeurd.{{rejectionReason}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "auth.team_invite",
    module: "AUTH",
    name: "Auth — Team-uitnodiging",
    type: "CUSTOM",
    description: "Team workspace uitnodiging",
    subject: "Bevestig je team-uitnodiging voor Digitify Lead Finder",
    layout: "minimal",
    body: [
      "Hallo {{contactName}},",
      "",
      "Je bent uitgenodigd voor een team workspace in Digitify Lead Finder.",
      "Bevestig je e-mailadres via deze link:",
      "{{verifyUrl}}",
      "",
      "Na bevestiging word je gekoppeld aan de gedeelde team-workspace.",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "auth.team_activated",
    module: "AUTH",
    name: "Auth — Team geactiveerd",
    type: "CUSTOM",
    description: "Team-uitnodiging bevestigd",
    subject: "Je team-uitnodiging is geactiveerd",
    layout: "minimal",
    body: [
      "Hallo {{contactName}},",
      "",
      "Je hebt de team-uitnodiging bevestigd. Je kunt nu inloggen en werkt voortaan in de gedeelde workspace van je team.",
      "",
      "Login: {{loginUrl}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "review.request",
    module: "REVIEWS",
    name: "Review — Verzoek",
    type: "REVIEW",
    description: "Reviewverzoek naar klant",
    subject: "Korte feedbackvraag",
    layout: "minimal",
    ctaText: "Geef uw beoordeling",
    ctaUrl: "{{reviewLink}}",
    body: [
      "Beste {{contactName}},",
      "",
      "{{reviewBody}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "invoice.sent",
    module: "INVOICES",
    name: "Factuur — Verzonden",
    type: "CUSTOM",
    description: "Factuur naar klant",
    subject: "Factuur {{invoiceNumber}}",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "In bijlage vindt u factuur {{invoiceNumber}}.",
      "Totaalbedrag: {{invoiceAmount}}",
      "Vervaldatum: {{dueDate}}",
      "Betalingsreferentie: {{paymentReference}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "invoice.reminder",
    module: "INVOICES",
    name: "Factuur — Herinnering",
    type: "CUSTOM",
    description: "Betalingsherinnering",
    subject: "Betalingsherinnering {{invoiceNumber}}",
    layout: "business",
    body: [
      "Beste {{contactName}},",
      "",
      "Dit is een vriendelijke herinnering voor factuur {{invoiceNumber}}.",
      "Vervaldatum: {{dueDate}}",
      "Openstaand bedrag: {{invoiceAmount}}",
      "Betalingsreferentie: {{paymentReference}}",
      "",
      "Gelieve dit bedrag zo snel mogelijk te voldoen.",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "campaign.drip_step_2",
    module: "CAMPAIGNS",
    name: "Campagne — Drip stap 2",
    type: "FOLLOW_UP",
    description: "Tweede stap in drip-campagne",
    subject: "Opvolging: {{baseSubject}}",
    layout: "followup",
    body: [
      "Beste {{contactName}},",
      "",
      "Ik volg even kort op over mijn eerdere bericht.",
      "Denk je dat dit momenteel relevant is voor {{companyName}}?",
      "",
      "Als je wil, plan ik meteen een kort gesprek in.",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "campaign.drip_step_3",
    module: "CAMPAIGNS",
    name: "Campagne — Drip stap 3",
    type: "FOLLOW_UP",
    description: "Derde stap in drip-campagne",
    subject: "Laatste opvolging: {{baseSubject}}",
    layout: "followup",
    body: [
      "Beste {{contactName}},",
      "",
      "Ik laat nog één laatste bericht na.",
      "Als dit nu geen prioriteit is, geen probleem.",
      "Laat gerust weten wanneer het beter past voor {{companyName}}.",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "campaign.review_step_2",
    module: "CAMPAIGNS",
    name: "Campagne — Review stap 2",
    type: "REVIEW",
    description: "Tweede review-opvolging",
    subject: "Korte opvolging over je ervaring",
    layout: "followup",
    body: [
      "Beste {{contactName}},",
      "",
      "Even een korte opvolging op mijn vorige bericht.",
      "Heb je 1 minuut om je ervaring te delen? Dat helpt ons enorm.",
      "",
      "Alvast bedankt!",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "campaign.review_step_3",
    module: "CAMPAIGNS",
    name: "Campagne — Review stap 3",
    type: "REVIEW",
    description: "Laatste review-herinnering",
    subject: "Laatste herinnering",
    layout: "followup",
    body: [
      "Beste {{contactName}},",
      "",
      "Dit is mijn laatste korte herinnering.",
      "Als je even feedback wil delen, hoor ik het heel graag.",
      "",
      "Bedankt voor je tijd.",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "feedback.admin_notify",
    module: "SYSTEM",
    name: "Systeem — Feedback notificatie",
    type: "CUSTOM",
    description: "Admin notificatie bij feedback",
    subject: "{{feedbackSubject}}",
    layout: "minimal",
    body: [
      "{{feedbackBody}}",
    ].join("\n"),
    isSystem: true,
  },
  {
    templateKey: "system.registration_admin",
    module: "SYSTEM",
    name: "Systeem — Nieuwe registratie",
    type: "CUSTOM",
    description: "Admin notificatie nieuwe registratie",
    subject: "Nieuwe registratieaanvraag voor Digitify Lead Finder",
    layout: "minimal",
    body: [
      "Er is een nieuwe geverifieerde registratieaanvraag.",
      "",
      "Naam: {{contactName}}",
      "E-mail: {{clientEmail}}",
      "Bedrijf: {{companyName}}",
      "",
      "Bekijk de aanvraag bij Instellingen > Team & Rollen.",
    ].join("\n"),
    isSystem: true,
  },
];

function systemTemplateToDbPayload(item: SystemEmailTemplateDef) {
  return {
    name: item.name,
    subject: item.subject,
    module: item.module,
    templateKey: item.templateKey,
    isSystem: item.isSystem,
    isGlobal: false,
    ...emailTemplateDataFromInput({
      body: item.body,
      bodyFormat: item.bodyFormat,
      layout: item.layout ?? "business",
      type: item.type,
      description: item.description,
      ctaText: item.ctaText,
      ctaUrl: item.ctaUrl,
    }),
  };
}

export async function ensureSystemEmailTemplates(db: PrismaClient, workspaceId: string) {
  for (const item of EMAIL_SYSTEM_TEMPLATES) {
    const payload = systemTemplateToDbPayload(item);
    const existing = await db.emailTemplate.findFirst({
      where: { createdById: workspaceId, templateKey: item.templateKey },
      select: { id: true },
    });
    if (!existing) {
      await db.emailTemplate.create({
        data: { createdById: workspaceId, ...payload },
      });
    }
  }
}

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

  await ensureSystemEmailTemplates(db, workspaceId);

  return { created, updated, total: EMAIL_TEMPLATE_STARTER_PACK.length };
}
