import { trpc } from "@/lib/trpc/client";
import type { EmailLayout } from "@digitify/email/layouts";

const OUTBOUND_SETTINGS_OPTS = {
  staleTime: 5 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;

export function useOutboundEmailSettings() {
  const { data: settings } = trpc.settings.getEmailComposeSettings.useQuery(undefined, OUTBOUND_SETTINGS_OPTS);

  return {
    brandCompanyName: settings?.["branding.company_name"] ? String(settings["branding.company_name"]) : "",
    brandPrimaryColor: settings?.["branding.primary_color"]
      ? String(settings["branding.primary_color"])
      : "#6366f1",
    brandWebsite: settings?.["branding.website"]
      ? String(settings["branding.website"])
      : settings?.["company.website"]
        ? String(settings["company.website"])
        : "",
    brandHeaderSlogan: settings?.["email.header_slogan"] ? String(settings["email.header_slogan"]) : "",
    followupDays: settings?.["email.followup_days"]
      ? Math.max(1, Number.parseInt(String(settings["email.followup_days"]), 10) || 3)
      : 3,
    typographyMode: settings?.["display.typography_mode"] === "normal" ? ("normal" as const) : ("compact" as const),
    defaultEmailLayout: settings?.["email.default_layout"]
      ? (String(settings["email.default_layout"]) as EmailLayout)
      : ("proposal" as EmailLayout),
    senderEmail: settings?.["email.from_email"] ? String(settings["email.from_email"]) : "",
    senderName: settings?.["email.from_name"] ? String(settings["email.from_name"]) : "",
    senderTitle: settings?.["email.from_title"] ? String(settings["email.from_title"]) : "",
    senderPhone: settings?.["company.phone"] ? String(settings["company.phone"]) : "",
  };
}

export function useOutboundEmailPreviewSettings() {
  const { data: branding } = trpc.settings.getBranding.useQuery(undefined, OUTBOUND_SETTINGS_OPTS);

  return {
    brandCompanyName: branding?.["branding.company_name"] ? String(branding["branding.company_name"]) : "",
    brandPrimaryColor: branding?.["branding.primary_color"]
      ? String(branding["branding.primary_color"])
      : "#6366f1",
    brandHeaderSlogan: branding?.["email.header_slogan"] ? String(branding["email.header_slogan"]) : "",
  };
}
