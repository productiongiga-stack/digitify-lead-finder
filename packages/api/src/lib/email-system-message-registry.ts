import type { EmailModuleKey } from "./email-template-starter-pack";

export type SystemMessageRegistryEntry = {
  templateKey: string;
  module: EmailModuleKey;
  trigger: string;
  placeholders: string[];
};

export const SYSTEM_MESSAGE_REGISTRY: SystemMessageRegistryEntry[] = [
  {
    templateKey: "booking.pending",
    module: "BOOKINGS",
    trigger: "Na ontvangst van een nieuwe boekingsaanvraag",
    placeholders: ["contactName", "senderCompany", "bookingDetails", "manageUrl"],
  },
  {
    templateKey: "booking.confirmed",
    module: "BOOKINGS",
    trigger: "Wanneer een afspraak wordt bevestigd",
    placeholders: ["contactName", "senderCompany", "bookingDetails"],
  },
  {
    templateKey: "booking.updated",
    module: "BOOKINGS",
    trigger: "Wanneer een afspraak wordt gewijzigd",
    placeholders: ["contactName", "senderCompany", "bookingDetails"],
  },
  {
    templateKey: "booking.cancelled",
    module: "BOOKINGS",
    trigger: "Wanneer een boeking wordt afgewezen of geannuleerd",
    placeholders: ["contactName", "senderCompany", "bookingDetails", "rejectionReason"],
  },
  {
    templateKey: "booking.reminder_24h",
    module: "BOOKINGS",
    trigger: "Automatische herinnering 24 uur voor de afspraak",
    placeholders: ["contactName", "senderCompany", "bookingDetails"],
  },
  {
    templateKey: "booking.reminder_1h",
    module: "BOOKINGS",
    trigger: "Automatische herinnering 1 uur voor de afspraak",
    placeholders: ["contactName", "bookingDetails"],
  },
  {
    templateKey: "booking.admin_notify",
    module: "BOOKINGS",
    trigger: "Interne notificatie naar workspace-admins",
    placeholders: ["adminSubject", "adminIntro", "contactName", "clientEmail", "bookingDetails"],
  },
  {
    templateKey: "auth.verify_email",
    module: "AUTH",
    trigger: "Bij registratie — e-mailverificatie",
    placeholders: ["contactName", "verifyUrl"],
  },
  {
    templateKey: "auth.approved",
    module: "AUTH",
    trigger: "Wanneer een registratieaanvraag wordt goedgekeurd",
    placeholders: ["contactName", "loginUrl"],
  },
  {
    templateKey: "auth.rejected",
    module: "AUTH",
    trigger: "Wanneer een registratieaanvraag wordt afgewezen",
    placeholders: ["contactName", "rejectionReason"],
  },
  {
    templateKey: "auth.team_invite",
    module: "AUTH",
    trigger: "Bij uitnodiging voor een gedeelde werkruimte",
    placeholders: ["contactName", "verifyUrl", "loginUrl", "workspaceName"],
  },
  {
    templateKey: "auth.team_activated",
    module: "AUTH",
    trigger: "Na bevestiging van een team-uitnodiging",
    placeholders: ["contactName", "loginUrl"],
  },
  {
    templateKey: "review.request",
    module: "REVIEWS",
    trigger: "Bij versturen van een reviewverzoek naar een klant",
    placeholders: ["contactName", "reviewBody", "reviewLink"],
  },
  {
    templateKey: "invoice.sent",
    module: "INVOICES",
    trigger: "Bij verzenden van een factuur",
    placeholders: ["contactName", "invoiceNumber", "invoiceAmount", "dueDate", "paymentReference"],
  },
  {
    templateKey: "invoice.reminder",
    module: "INVOICES",
    trigger: "Bij versturen van een betalingsherinnering",
    placeholders: ["contactName", "invoiceNumber", "invoiceAmount", "dueDate", "paymentReference"],
  },
  {
    templateKey: "campaign.drip_step_2",
    module: "CAMPAIGNS",
    trigger: "Campagne drip — stap 2 (gepland na stap 1)",
    placeholders: ["contactName", "companyName", "baseSubject"],
  },
  {
    templateKey: "campaign.drip_step_3",
    module: "CAMPAIGNS",
    trigger: "Campagne drip — stap 3 (laatste opvolging)",
    placeholders: ["contactName", "companyName", "baseSubject"],
  },
  {
    templateKey: "campaign.review_step_2",
    module: "CAMPAIGNS",
    trigger: "Review-campagne — opvolging stap 2",
    placeholders: ["contactName"],
  },
  {
    templateKey: "campaign.review_step_3",
    module: "CAMPAIGNS",
    trigger: "Review-campagne — laatste herinnering stap 3",
    placeholders: ["contactName"],
  },
  {
    templateKey: "feedback.admin_notify",
    module: "SYSTEM",
    trigger: "Wanneer een gebruiker feedback indient in de app",
    placeholders: ["feedbackSubject", "feedbackBody"],
  },
  {
    templateKey: "system.registration_admin",
    module: "SYSTEM",
    trigger: "Notificatie naar admins bij nieuwe registratieaanvraag",
    placeholders: ["contactName", "clientEmail", "companyName"],
  },
];

const registryByKey = new Map(
  SYSTEM_MESSAGE_REGISTRY.map((entry) => [entry.templateKey, entry]),
);

export function getSystemMessageRegistry(templateKey: string) {
  return registryByKey.get(templateKey);
}

export const SYSTEM_MESSAGE_MODULES = [
  "AUTH",
  "BOOKINGS",
  "CAMPAIGNS",
  "INVOICES",
  "REVIEWS",
  "SYSTEM",
] as const satisfies readonly EmailModuleKey[];

export const SYSTEM_MESSAGE_MODULE_LABELS: Record<(typeof SYSTEM_MESSAGE_MODULES)[number], string> = {
  AUTH: "Authenticatie & team",
  BOOKINGS: "Boekingen",
  CAMPAIGNS: "Campagnes",
  INVOICES: "Facturen",
  REVIEWS: "Reviews",
  SYSTEM: "Systeem",
};
