import { trpc } from "@/lib/trpc/client";
import { readSettingString } from "@/lib/settings";
import { useShellContext } from "@/components/layout/shell-provider";

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

const DEFAULT_PRIMARY_COLOR = "#f9ae5a";

function buildBrandingFromSettings(settings: Record<string, unknown> | undefined): BrandingConfig {
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

const EMPTY_BRANDING = buildBrandingFromSettings(undefined);

export function useBranding(enabled = true): { branding: BrandingConfig; isLoading: boolean } {
  const shell = useShellContext();
  const useShellBranding = enabled && shell.isAppShell;

  const { data: settings, isLoading: brandingLoading } = trpc.settings.getBranding.useQuery(undefined, {
    enabled: enabled && !useShellBranding,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (useShellBranding) {
    if (shell.data?.settings) {
      return { branding: buildBrandingFromSettings(shell.data.settings), isLoading: false };
    }
    return { branding: EMPTY_BRANDING, isLoading: shell.isLoading };
  }

  return {
    branding: buildBrandingFromSettings(settings),
    isLoading: brandingLoading,
  };
}

/**
 * Get branding config from raw settings object (server-side).
 * Use this in API routes / tRPC procedures.
 */
export function getBrandingFromSettings(settings: Record<string, unknown>): BrandingConfig {
  return buildBrandingFromSettings(settings);
}
