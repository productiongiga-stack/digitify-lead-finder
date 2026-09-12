import type { PrismaClient } from "@digitify/db";
import type { WebsiteAnalysis } from "@digitify/connectors";

type DomainInsightDb = Pick<PrismaClient, "domain" | "enrichmentData">;

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

export type DomainTrackerHit = {
  visitorId: string;
  sessionId?: string;
  pageUrl: string;
  title: string;
  referrerSource: string;
  language: string;
  timezone: string;
  deviceType: string;
  browser: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  occurredAt: string;
};

const TRACKER_LIMITS = {
  devices: 10,
  browsers: 10,
  campaigns: 10,
  pages: 20,
  referrers: 10,
  visitors: 50,
} as const;

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function createDomainTrackerStore(domainId: string, domainName: string): DomainTrackerStore {
  return {
    domainId,
    domainName,
    summary: { pageviews: 0, uniqueVisitors: 0, lastSeen: null },
    devices: [],
    browsers: [],
    campaigns: [],
    pages: [],
    referrers: [],
    visitors: [],
  };
}

/**
 * Applies one public tracker hit to the bounded, JSON-backed analytics snapshot.
 * The summary remains cumulative even when detailed lists are trimmed for storage.
 */
export function applyDomainTrackerHit(
  current: DomainTrackerStore | null | undefined,
  hit: DomainTrackerHit,
  domain: { id: string; domainName: string },
): DomainTrackerStore {
  const fallback = createDomainTrackerStore(domain.id, domain.domainName);
  const tracker = current ?? fallback;
  const pages = Array.isArray(tracker.pages) ? [...tracker.pages] : [];
  const referrers = Array.isArray(tracker.referrers) ? [...tracker.referrers] : [];
  const visitors = Array.isArray(tracker.visitors) ? [...tracker.visitors] : [];
  const devices = Array.isArray(tracker.devices) ? [...tracker.devices] : [];
  const browsers = Array.isArray(tracker.browsers) ? [...tracker.browsers] : [];
  const campaigns = Array.isArray(tracker.campaigns) ? [...tracker.campaigns] : [];
  const visitorKey = hit.sessionId || hit.visitorId;

  const pageIndex = pages.findIndex((item) => item.url === hit.pageUrl);
  if (pageIndex >= 0) {
    const page = pages[pageIndex]!;
    pages[pageIndex] = { ...page, count: positiveInteger(page.count) + 1, lastSeen: hit.occurredAt, title: hit.title || page.title };
  } else {
    pages.unshift({ url: hit.pageUrl, title: hit.title, count: 1, lastSeen: hit.occurredAt });
  }

  const referrerIndex = referrers.findIndex((item) => item.source === hit.referrerSource);
  if (referrerIndex >= 0) {
    const referrer = referrers[referrerIndex]!;
    referrers[referrerIndex] = { ...referrer, count: positiveInteger(referrer.count) + 1 };
  } else {
    referrers.push({ source: hit.referrerSource, count: 1 });
  }

  const visitorIndex = visitors.findIndex((item) => item.id === visitorKey);
  if (visitorIndex >= 0) {
    const visitor = visitors[visitorIndex]!;
    visitors[visitorIndex] = {
      ...visitor,
      count: positiveInteger(visitor.count) + 1,
      lastSeen: hit.occurredAt,
      pageUrl: hit.pageUrl,
      language: hit.language || visitor.language,
      timezone: hit.timezone || visitor.timezone,
      deviceType: hit.deviceType,
      browser: hit.browser,
    };
  } else {
    visitors.push({
      id: visitorKey,
      count: 1,
      lastSeen: hit.occurredAt,
      pageUrl: hit.pageUrl,
      language: hit.language,
      timezone: hit.timezone,
      deviceType: hit.deviceType,
      browser: hit.browser,
    });
  }

  const deviceIndex = devices.findIndex((item) => item.type === hit.deviceType);
  if (deviceIndex >= 0) {
    const device = devices[deviceIndex]!;
    devices[deviceIndex] = { ...device, count: positiveInteger(device.count) + 1 };
  } else {
    devices.push({ type: hit.deviceType, count: 1 });
  }

  const browserIndex = browsers.findIndex((item) => item.name === hit.browser);
  if (browserIndex >= 0) {
    const browser = browsers[browserIndex]!;
    browsers[browserIndex] = { ...browser, count: positiveInteger(browser.count) + 1 };
  } else {
    browsers.push({ name: hit.browser, count: 1 });
  }

  if (hit.utmSource || hit.utmMedium || hit.utmCampaign) {
    const source = hit.utmSource || "direct";
    const medium = hit.utmMedium || "unknown";
    const campaign = hit.utmCampaign || "default";
    const campaignIndex = campaigns.findIndex(
      (item) => item.source === source && item.medium === medium && item.campaign === campaign,
    );
    if (campaignIndex >= 0) {
      const existingCampaign = campaigns[campaignIndex]!;
      campaigns[campaignIndex] = { ...existingCampaign, count: positiveInteger(existingCampaign.count) + 1 };
    } else {
      campaigns.push({ source, medium, campaign, count: 1 });
    }
  }

  const priorSummary = tracker.summary ?? fallback.summary;
  const knownVisitors = Math.max(positiveInteger(priorSummary.uniqueVisitors), visitors.length - (visitorIndex < 0 ? 1 : 0));
  return {
    domainId: domain.id,
    domainName: domain.domainName,
    summary: {
      pageviews: positiveInteger(priorSummary.pageviews) + 1,
      uniqueVisitors: knownVisitors + (visitorIndex < 0 ? 1 : 0),
      lastSeen: hit.occurredAt,
    },
    devices: devices.sort((a, b) => b.count - a.count).slice(0, TRACKER_LIMITS.devices),
    browsers: browsers.sort((a, b) => b.count - a.count).slice(0, TRACKER_LIMITS.browsers),
    campaigns: campaigns.sort((a, b) => b.count - a.count).slice(0, TRACKER_LIMITS.campaigns),
    pages: pages.sort((a, b) => b.count - a.count).slice(0, TRACKER_LIMITS.pages),
    referrers: referrers.sort((a, b) => b.count - a.count).slice(0, TRACKER_LIMITS.referrers),
    visitors: visitors.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, TRACKER_LIMITS.visitors),
  };
}

type EnrichmentRow = { source: string; data: unknown; fetchedAt?: Date | string | null };

type DomainInsightSource = {
  id: string;
  domainName: string;
  leadId?: string | null;
  sslStatus?: string | null;
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
  db: DomainInsightDb,
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
  db: DomainInsightDb,
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
