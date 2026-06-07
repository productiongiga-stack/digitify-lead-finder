import { trpc } from "@/lib/trpc/client";
import { DEFAULT_MASTER_SHELL_HTML } from "@digitify/email/master-shell";

const OUTBOUND_SETTINGS_OPTS = {
  staleTime: 5 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;

function readShellHtml(settings: Record<string, unknown> | undefined) {
  return String(
    settings?.["email.master_shell_html"]
    || settings?.["email.custom_html"]
    || DEFAULT_MASTER_SHELL_HTML,
  );
}

export function useOutboundEmailSettings() {
  const { data: settings } = trpc.settings.getEmailComposeSettings.useQuery(undefined, OUTBOUND_SETTINGS_OPTS);

  return {
    brandCompanyName: settings?.["branding.company_name"] ? String(settings["branding.company_name"]) : "",
    brandPrimaryColor: settings?.["branding.primary_color"]
      ? String(settings["branding.primary_color"])
      : "#6366f1",
    brandLogoUrl: settings?.["branding.logo_url"] ? String(settings["branding.logo_url"]) : "",
    brandWebsite: settings?.["branding.website"]
      ? String(settings["branding.website"])
      : settings?.["company.website"]
        ? String(settings["company.website"])
        : "",
    brandHeaderSlogan: settings?.["email.header_slogan"] ? String(settings["email.header_slogan"]) : "",
    emailSignature: settings?.["email.signature"] ? String(settings["email.signature"]) : "",
    emailFooter: settings?.["email.footer"] ? String(settings["email.footer"]) : "",
    followupDays: settings?.["email.followup_days"]
      ? Math.max(1, Number.parseInt(String(settings["email.followup_days"]), 10) || 3)
      : 3,
    typographyMode: settings?.["display.typography_mode"] === "normal" ? ("normal" as const) : ("compact" as const),
    masterShellHtml: readShellHtml(settings),
    /** @deprecated Layout picker removed — compose keeps field for backward UI compat */
    defaultEmailLayout: "proposal" as const,
    senderEmail: settings?.["email.from_email"] ? String(settings["email.from_email"]) : "",
    senderName: settings?.["email.from_name"] ? String(settings["email.from_name"]) : "",
    senderTitle: settings?.["email.from_title"] ? String(settings["email.from_title"]) : "",
    senderPhone: settings?.["company.phone"] ? String(settings["company.phone"]) : "",
  };
}

export function useOutboundEmailPreviewSettings() {
  const { data: branding } = trpc.settings.getBranding.useQuery(undefined, OUTBOUND_SETTINGS_OPTS);

  const companyName = branding?.["branding.company_name"]
    ? String(branding["branding.company_name"])
    : branding?.["email.from_name"]
      ? String(branding["email.from_name"])
      : "";

  return {
    brandCompanyName: companyName,
    brandPrimaryColor: branding?.["branding.primary_color"]
      ? String(branding["branding.primary_color"])
      : "#6366f1",
    brandLogoUrl: branding?.["branding.logo_url"] ? String(branding["branding.logo_url"]) : "",
    brandHeaderSlogan: branding?.["email.header_slogan"] ? String(branding["email.header_slogan"]) : "",
    masterShellHtml: readShellHtml(branding),
    emailSignature: branding?.["email.signature"] ? String(branding["email.signature"]) : "",
    emailFooter: branding?.["email.footer"] ? String(branding["email.footer"]) : "",
    senderName: branding?.["email.from_name"] ? String(branding["email.from_name"]) : companyName,
  };
}

/** Props bundle for EmailPreview with workspace shell + branding. */
export function useShellEmailPreviewProps() {
  const preview = useOutboundEmailPreviewSettings();
  return {
    companyName: preview.brandCompanyName || "Digitify",
    primaryColor: preview.brandPrimaryColor,
    logoUrl: preview.brandLogoUrl || undefined,
    headerSlogan: preview.brandHeaderSlogan,
    masterShellHtml: preview.masterShellHtml,
    signature: preview.emailSignature,
    footer: preview.emailFooter,
    fromName: preview.senderName || preview.brandCompanyName || "Digitify",
  };
}
