import type { PrismaClient } from "@digitify/db";
import type { WebsiteAnalysis } from "@digitify/connectors";

export type DomainTrackerStore = {
  domainId: string;
  domainName: string;
  summary: {
    pageviews: number;
    uniqueVisitors: number;
    lastSeen: string | null;
  };
  devices: Array<{ type: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  campaigns: Array<{ source: string; medium: string; campaign: string; count: number }>;
  pages: Array<{ url: string; title: string; count: number; lastSeen: string }>;
  referrers: Array<{ source: string; count: number }>;
  visitors: Array<{
    id: string;
    count: number;
    lastSeen: string;
    pageUrl: string;
    language: string;
    timezone: string;
    deviceType: string;
    browser: string;
  }>;
};

type EnrichmentRow = { source: string; data: unknown; fetchedAt?: Date | string | null };

type DomainInsightSource = {
  id: string;
  domainName: string;
  analysisData?: unknown;
  trackerData?: unknown;
  lastAnalyzedAt?: Date | string | null;
  lastTrackerAt?: Date | string | null;
  healthScore?: number | null;
  expiresAt?: Date | string | null;
  status?: string | null;
  lead?: {
    companyName?: string | null;
    enrichmentData?: EnrichmentRow[];
  } | null;
};

const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function deriveExpiryStatus(expiresAt: Date | null | undefined, currentStatus?: string | null) {
  if (currentStatus === "TRANSFERRED") return "TRANSFERRED";
  if (!expiresAt) return "ACTIVE";
  const expiryMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryMs)) return "ACTIVE";
  if (expiryMs < Date.now()) return "EXPIRED";
  if (expiryMs < Date.now() + EXPIRING_WINDOW_MS) return "EXPIRING";
  return "ACTIVE";
}

export function computeHealthScore(analysis?: Partial<WebsiteAnalysis> | null) {
  if (!analysis) return 0;
  let score = 100;
  const statusCode = analysis.statusCode ?? 0;
  const loadTimeMs = analysis.loadTimeMs ?? 0;
  if (statusCode >= 400 || statusCode < 200) score -= 35;
  if (loadTimeMs > 3500) score -= 18;
  else if (loadTimeMs > 2200) score -= 10;
  if (!analysis.hasSSL) score -= 14;
  if (!analysis.isMobileFriendly) score -= 10;
  if (!analysis.hasMetaTitle) score -= 6;
  if (!analysis.hasMetaDescription) score -= 6;
  if (!analysis.hasH1) score -= 5;
  if (!analysis.hasStructuredData) score -= 4;
  if (!analysis.hasCTA) score -= 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function resolveDomainAnalysis(domain: DomainInsightSource): WebsiteAnalysis | null {
  if (domain.analysisData && typeof domain.analysisData === "object") {
    return domain.analysisData as WebsiteAnalysis;
  }
  const legacy = domain.lead?.enrichmentData?.find((item) => item.source === "domain_analysis")?.data;
  return legacy && typeof legacy === "object" ? (legacy as WebsiteAnalysis) : null;
}

export function resolveDomainTracker(domain: DomainInsightSource): DomainTrackerStore | null {
  if (domain.trackerData && typeof domain.trackerData === "object") {
    return domain.trackerData as DomainTrackerStore;
  }
  const legacy = domain.lead?.enrichmentData?.find((item) => item.source === `website_tracker:${domain.id}`)?.data;
  return legacy && typeof legacy === "object" ? (legacy as DomainTrackerStore) : null;
}

export function resolveWebsiteStatus(analysis?: Partial<WebsiteAnalysis> | null) {
  if (!analysis || analysis.statusCode === undefined) return "unknown" as const;
  if (analysis.statusCode >= 200 && analysis.statusCode < 400) {
    return (analysis.loadTimeMs ?? 0) > 3000 ? ("slow" as const) : ("online" as const);
  }
  return "offline" as const;
}

export function buildDomainOpportunities(analysis?: Partial<WebsiteAnalysis> | null) {
  return [
    !analysis?.hasMetaTitle ? "Meta title ontbreekt of is zwak. Optimaliseer title per pagina." : null,
    !analysis?.hasMetaDescription ? "Meta beschrijving ontbreekt. Voeg converterende snippet toe." : null,
    !analysis?.hasH1 ? "Geen H1 gevonden. Voorzie duidelijke primaire heading." : null,
    !analysis?.isMobileFriendly ? "Mobielvriendelijkheid verbeteren voor hogere conversie op smartphone." : null,
    !analysis?.hasCTA ? "Voeg een duidelijke CTA toe op de homepage." : null,
    (analysis?.loadTimeMs || 0) > 2500 ? "Laadtijd is hoog. Optimaliseer afbeeldingen en scripts." : null,
    !analysis?.hasStructuredData ? "Structured data ontbreekt. Voeg schema.org markup toe." : null,
    !analysis?.hasAnalytics ? "Analytics detectie ontbreekt. Meet verkeer en conversies." : null,
    (analysis?.uxAudit?.pagesBroken || 0) > 0
      ? `${analysis?.uxAudit?.pagesBroken} subpagina('s) reageren niet goed. Controleer broken links.`
      : null,
    (analysis?.uxAudit?.imagesMissingAlt || 0) > 0
      ? `${analysis?.uxAudit?.imagesMissingAlt} afbeeldingen missen alt-tekst.`
      : null,
  ].filter((item): item is string => Boolean(item));
}

export async function syncWorkspaceDomainExpiry(db: PrismaClient, workspaceId: string) {
  const domains = await db.domain.findMany({
    where: { createdById: workspaceId, expiresAt: { not: null } },
    select: { id: true, expiresAt: true, status: true },
  });

  await Promise.all(
    domains.map((domain) => {
      const nextStatus = deriveExpiryStatus(domain.expiresAt, domain.status);
      if (nextStatus === domain.status) return Promise.resolve();
      return db.domain.update({ where: { id: domain.id }, data: { status: nextStatus } });
    }),
  );
}

export async function persistDomainAnalysis(
  db: PrismaClient,
  params: {
    domainId: string;
    leadId?: string | null;
    analysis: WebsiteAnalysis;
  },
) {
  const healthScore = computeHealthScore(params.analysis);
  const sslStatus = params.analysis.hasSSL ? "VALID" : "NONE";
  const now = new Date();

  await db.domain.update({
    where: { id: params.domainId },
    data: {
      sslStatus,
      analysisData: params.analysis as object,
      lastAnalyzedAt: now,
      healthScore,
    },
  });

  if (params.leadId) {
    await db.enrichmentData.upsert({
      where: {
        leadId_source: {
          leadId: params.leadId,
          source: "domain_analysis",
        },
      },
      create: {
        leadId: params.leadId,
        source: "domain_analysis",
        data: params.analysis as object,
      },
      update: {
        data: params.analysis as object,
        fetchedAt: now,
      },
    });
  }

  return { healthScore, sslStatus };
}

export async function persistDomainTracker(
  db: PrismaClient,
  params: {
    domainId: string;
    leadId?: string | null;
    tracker: DomainTrackerStore;
  },
) {
  const now = new Date();
  await db.domain.update({
    where: { id: params.domainId },
    data: {
      trackerData: params.tracker as object,
      lastTrackerAt: now,
    },
  });

  if (params.leadId) {
    await db.enrichmentData.upsert({
      where: {
        leadId_source: {
          leadId: params.leadId,
          source: `website_tracker:${params.domainId}`,
        },
      },
      create: {
        leadId: params.leadId,
        source: `website_tracker:${params.domainId}`,
        data: params.tracker as object,
      },
      update: {
        data: params.tracker as object,
        fetchedAt: now,
      },
    });
  }
}

export function enrichDomainRecord<T extends DomainInsightSource>(domain: T) {
  const analysis = resolveDomainAnalysis(domain);
  const tracker = resolveDomainTracker(domain);
  const websiteStatus = resolveWebsiteStatus(analysis);
  const opportunities = buildDomainOpportunities(analysis);
  const healthScore = domain.healthScore ?? computeHealthScore(analysis);

  return {
    ...domain,
    analysis,
    tracker,
    websiteStatus,
    opportunities,
    healthScore,
    uniqueVisitors: tracker?.summary.uniqueVisitors ?? 0,
    pageviews: tracker?.summary.pageviews ?? 0,
    lastTrackerSeen: tracker?.summary.lastSeen ?? null,
  };
}
