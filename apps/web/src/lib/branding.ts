import { trpc } from "@/lib/trpc/client";
import { readSettingString } from "@/lib/settings";

/**
 * Central branding configuration.
 * Merges branding.* and company.* settings into a single consistent object.
 * All modules should use this hook instead of reading settings directly.
 */
export interface BrandingConfig {
  companyName: string;
  companySlogan: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  vatNumber: string;
  kboNumber: string;
  bankAccount: string;
  niche: string;
  emailFromName: string;
  emailFromEmail: string;
}

const DEFAULT_PRIMARY_COLOR = "#6366f1";

export function useBranding(): { branding: BrandingConfig; isLoading: boolean } {
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery(undefined, {
    staleTime: 60_000,
  });

  const get = (key: string, fallback = ""): string => readSettingString(settings, key, fallback);

  // Merge branding.* and company.* settings (branding.* takes precedence for display,
  // company.* is the canonical source for legal/contact info)
  const branding: BrandingConfig = {
    companyName: get("branding.company_name") || get("company.name") || "",
    companySlogan: get("branding.company_slogan"),
    logoUrl: get("branding.logo_url"),
    faviconUrl: get("branding.favicon_url"),
    primaryColor: get("branding.primary_color", DEFAULT_PRIMARY_COLOR),
    website: get("company.website") || get("branding.website"),
    phone: get("company.phone") || get("branding.phone"),
    email: get("company.email") || get("branding.email"),
    address: get("company.address") || get("branding.address"),
    vatNumber: get("company.vat") || get("branding.vat_number"),
    kboNumber: get("company.kbo"),
    bankAccount: get("branding.bank_account"),
    niche: get("company.niche"),
    emailFromName: get("email.from_name") || get("branding.company_name") || get("company.name") || "",
    emailFromEmail: get("email.from_email") || get("company.email") || "",
  };

  return { branding, isLoading };
}

/**
 * Get branding config from raw settings object (server-side).
 * Use this in API routes / tRPC procedures.
 */
export function getBrandingFromSettings(settings: Record<string, unknown>): BrandingConfig {
  const get = (key: string, fallback = ""): string => readSettingString(settings, key, fallback);

  return {
    companyName: get("branding.company_name") || get("company.name") || "",
    companySlogan: get("branding.company_slogan"),
    logoUrl: get("branding.logo_url"),
    faviconUrl: get("branding.favicon_url"),
    primaryColor: get("branding.primary_color", DEFAULT_PRIMARY_COLOR),
    website: get("company.website") || get("branding.website"),
    phone: get("company.phone") || get("branding.phone"),
    email: get("company.email") || get("branding.email"),
    address: get("company.address") || get("branding.address"),
    vatNumber: get("company.vat") || get("branding.vat_number"),
    kboNumber: get("company.kbo"),
    bankAccount: get("branding.bank_account"),
    niche: get("company.niche"),
    emailFromName: get("email.from_name") || get("branding.company_name") || get("company.name") || "",
    emailFromEmail: get("email.from_email") || get("company.email") || "",
  };
}
