export type EmailShellBrandingContext = {
  companyName: string;
  primaryColor: string;
  logoUrl?: string;
  headerSlogan?: string;
  fromName?: string;
  fromEmail?: string;
  fromTitle?: string;
  signature?: string;
  footer?: string;
};

export type EmailShellChecklistAction =
  | { type: "email-tab"; tab: "identity" | "design" }
  | { type: "link"; href: string };

export type EmailShellChecklistItem = {
  id: string;
  label: string;
  description: string;
  complete: boolean;
  required: boolean;
  action: EmailShellChecklistAction;
  fieldId?: string;
};

const DEFAULT_PRIMARY = "#f9ae5a";

function filled(value?: string) {
  return Boolean(value?.trim());
}

export function getEmailShellBrandingChecklist(
  branding: EmailShellBrandingContext,
): EmailShellChecklistItem[] {
  const companyName = branding.companyName?.trim() || "";
  const primaryColor = branding.primaryColor?.trim() || DEFAULT_PRIMARY;
  const hasCustomColor = primaryColor.toLowerCase() !== DEFAULT_PRIMARY;

  return [
    {
      id: "companyName",
      label: "Bedrijfsnaam",
      description: "Zichtbaar in header en footer van elke mail",
      complete: filled(companyName),
      required: true,
      action: { type: "link", href: "/settings/branding" },
      fieldId: "branding-company-name",
    },
    {
      id: "primaryColor",
      label: "Merkkleur",
      description: hasCustomColor ? primaryColor : "Nog de standaardkleur — kies je eigen tint",
      complete: hasCustomColor,
      required: false,
      action: { type: "link", href: "/settings/branding" },
      fieldId: "branding-primary-color",
    },
    {
      id: "logoUrl",
      label: "Logo",
      description: "Wordt getoond via {{logoBlock}} in de shell",
      complete: filled(branding.logoUrl),
      required: false,
      action: { type: "link", href: "/settings/branding" },
      fieldId: "branding-logo",
    },
    {
      id: "fromName",
      label: "Afzendernaam",
      description: "Naam die ontvangers zien in de inbox",
      complete: filled(branding.fromName),
      required: true,
      action: { type: "email-tab", tab: "identity" },
      fieldId: "email-from-name",
    },
    {
      id: "fromEmail",
      label: "Afzender e-mail",
      description: "Verplicht voor betrouwbare verzending",
      complete: filled(branding.fromEmail),
      required: true,
      action: { type: "email-tab", tab: "identity" },
      fieldId: "email-from-email",
    },
    {
      id: "headerSlogan",
      label: "Slogan in header",
      description: "Ondertitel onder je bedrijfsnaam in de shell",
      complete: filled(branding.headerSlogan),
      required: false,
      action: { type: "email-tab", tab: "identity" },
      fieldId: "email-header-slogan",
    },
    {
      id: "signature",
      label: "Handtekening",
      description: "Afsluiting onder elk bericht",
      complete: filled(branding.signature),
      required: false,
      action: { type: "email-tab", tab: "identity" },
      fieldId: "email-signature",
    },
    {
      id: "footer",
      label: "Footer",
      description: "Juridische of contactregels onderaan de mail",
      complete: filled(branding.footer),
      required: false,
      action: { type: "email-tab", tab: "identity" },
      fieldId: "email-footer",
    },
  ];
}

export function getEmailShellChecklistSummary(items: EmailShellChecklistItem[]) {
  const required = items.filter((item) => item.required);
  const optional = items.filter((item) => !item.required);
  const requiredComplete = required.filter((item) => item.complete).length;
  const optionalComplete = optional.filter((item) => item.complete).length;
  const missingRequired = required.filter((item) => !item.complete);
  const missingOptional = optional.filter((item) => !item.complete);

  return {
    total: items.length,
    completeCount: items.filter((item) => item.complete).length,
    requiredTotal: required.length,
    requiredComplete,
    optionalTotal: optional.length,
    optionalComplete,
    missingRequired,
    missingOptional,
    isReady: missingRequired.length === 0,
    progressPercent: Math.round((items.filter((item) => item.complete).length / items.length) * 100),
  };
}

export function brandingToWizardDefaults(branding: EmailShellBrandingContext) {
  return {
    showLogoArea: filled(branding.logoUrl),
    showSlogan: filled(branding.headerSlogan),
  };
}

export const EMAIL_SHELL_PREVIEW_SUBJECT = "Voorbeeld: samenwerking met {{companyName}}";

export const EMAIL_SHELL_PREVIEW_BODY = [
  "Beste {{contactName}},",
  "",
  "Bedankt voor je tijd. Hieronder vind je een helder overzicht met de volgende stap voor onze samenwerking.",
  "",
  "Alles is bewust compact gehouden zodat je snel kan scannen en reageren.",
].join("\n");

export function buildEmailShellPreviewProps(
  branding: EmailShellBrandingContext,
  overrides?: {
    masterShellHtml?: string;
    previewSubject?: string;
    recipientCompany?: string;
    body?: string;
    bodyFormat?: "TEXT" | "HTML";
    ctaText?: string;
    ctaUrl?: string;
  },
) {
  const companyName = branding.companyName?.trim() || "Je bedrijf";

  return {
    subject: overrides?.previewSubject ?? EMAIL_SHELL_PREVIEW_SUBJECT,
    body: overrides?.body ?? EMAIL_SHELL_PREVIEW_BODY,
    bodyFormat: overrides?.bodyFormat,
    companyName,
    primaryColor: branding.primaryColor?.trim() || DEFAULT_PRIMARY,
    fromName: branding.fromName?.trim() || companyName,
    fromEmail: branding.fromEmail?.trim() || undefined,
    headerSlogan: branding.headerSlogan?.trim() || "",
    logoUrl: branding.logoUrl?.trim() || undefined,
    signature: branding.signature?.trim() || "",
    footer: branding.footer?.trim() || "",
    recipientCompany: overrides?.recipientCompany ?? "Voorbeeldbedrijf BV",
    ctaText: overrides?.ctaText ?? "Plan een gesprek",
    ctaUrl: overrides?.ctaUrl ?? "{{bookingLink}}",
    masterShellHtml: overrides?.masterShellHtml,
  };
}
