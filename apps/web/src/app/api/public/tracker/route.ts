import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { log } from "@digitify/api/src/lib/logger";
import { persistDomainTracker, type DomainTrackerStore } from "@digitify/api/src/lib/domain-insights";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getVisitorId(request: Request, payload: Record<string, unknown>) {
  const clientVisitorId = String(payload.visitorId || "").trim();
  if (clientVisitorId) return clientVisitorId.slice(0, 120);
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const userAgent = String(payload.userAgent || request.headers.get("user-agent") || "unknown").slice(0, 160);
  return `${ip}:${userAgent}`;
}

function getReferrerSource(referrer: string) {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer;
  }
}

function detectDeviceType(payload: Record<string, unknown>) {
  const width = Number(payload.screenWidth || 0);
  const userAgent = String(payload.userAgent || "").toLowerCase();
  if (userAgent.includes("ipad") || (width >= 768 && width <= 1024)) return "tablet";
  if (userAgent.includes("mobile") || width < 768) return "mobile";
  return "desktop";
}

function detectBrowser(payload: Record<string, unknown>) {
  const userAgent = String(payload.userAgent || "").toLowerCase();
  if (userAgent.includes("edg")) return "Edge";
  if (userAgent.includes("chrome")) return "Chrome";
  if (userAgent.includes("safari") && !userAgent.includes("chrome")) return "Safari";
  if (userAgent.includes("firefox")) return "Firefox";
  return "Other";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rawBody = await request.text();
    const payload = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
    const domainId = String(payload.domainId || "").trim();
    const pageUrl = String(payload.pageUrl || "").trim();
    const title = String(payload.title || "").trim();
    const referrer = String(payload.referrer || "").trim();
    const language = String(payload.language || "").trim();
    const timezone = String(payload.timezone || "").trim();
    const utmSource = String(payload.utmSource || "").trim();
    const utmMedium = String(payload.utmMedium || "").trim();
    const utmCampaign = String(payload.utmCampaign || "").trim();
    const sessionId = String(payload.sessionId || "").trim();

    if (!domainId || !pageUrl) {
      return NextResponse.json({ error: "Domein en pagina zijn verplicht." }, { status: 400, headers: corsHeaders });
    }
    const limiter = await enforceRateLimit(request, {
      key: `public-tracker:${domainId}:${ip}`,
      limit: 1200,
      windowMs: 60 * 60 * 1000,
      message: "Te veel tracking events. Probeer later opnieuw.",
    });
    if (limiter) {
      for (const [header, value] of Object.entries(corsHeaders)) {
        limiter.headers.set(header, value);
      }
      return limiter;
    }

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: {
        id: true,
        domainName: true,
        leadId: true,
        status: true,
        createdById: true,
        lead: { select: { id: true, createdById: true } },
      },
    });

    if (!domain || domain.status !== "ACTIVE") {
      return NextResponse.json({ success: false }, { headers: corsHeaders });
    }

    if (domain.lead && domain.lead.createdById !== domain.createdById) {
      return NextResponse.json({ success: false }, { headers: corsHeaders });
    }

    const domainRow = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { trackerData: true },
    });

    const now = new Date().toISOString();
    const visitorId = getVisitorId(request, payload);
    const referrerSource = getReferrerSource(referrer);
    const current = (domainRow?.trackerData as DomainTrackerStore | null) || {
      domainId: domain.id,
      domainName: domain.domainName,
      summary: {
        pageviews: 0,
        uniqueVisitors: 0,
        lastSeen: null,
      },
      devices: [],
      browsers: [],
      campaigns: [],
      pages: [],
      referrers: [],
      visitors: [],
    };

    const pages = [...current.pages];
    const deviceType = detectDeviceType(payload);
    const browser = detectBrowser(payload);
    const pageIndex = pages.findIndex((item) => item.url === pageUrl);
    if (pageIndex >= 0) {
      pages[pageIndex] = {
        ...pages[pageIndex],
        count: pages[pageIndex]!.count + 1,
        lastSeen: now,
        title: title || pages[pageIndex]!.title,
      };
    } else {
      pages.unshift({
        url: pageUrl,
        title,
        count: 1,
        lastSeen: now,
      });
    }

    const referrers = [...current.referrers];
    const referrerIndex = referrers.findIndex((item) => item.source === referrerSource);
    if (referrerIndex >= 0) {
      referrers[referrerIndex] = {
        ...referrers[referrerIndex],
        count: referrers[referrerIndex]!.count + 1,
      };
    } else {
      referrers.push({ source: referrerSource, count: 1 });
    }

    const visitors = [...current.visitors];
    const visitorIndex = visitors.findIndex((item) => item.id === visitorId);
    if (visitorIndex >= 0) {
      visitors[visitorIndex] = {
        ...visitors[visitorIndex],
        count: visitors[visitorIndex]!.count + 1,
        lastSeen: now,
        pageUrl,
        language: language || visitors[visitorIndex]!.language,
        timezone: timezone || visitors[visitorIndex]!.timezone,
        deviceType,
        browser,
      };
    } else {
      visitors.push({
        id: sessionId || visitorId,
        count: 1,
        lastSeen: now,
        pageUrl,
        language,
        timezone,
        deviceType,
        browser,
      });
    }

    const devices = [...current.devices];
    const deviceIndex = devices.findIndex((item) => item.type === deviceType);
    if (deviceIndex >= 0) {
      devices[deviceIndex] = {
        ...devices[deviceIndex],
        count: devices[deviceIndex]!.count + 1,
      };
    } else {
      devices.push({ type: deviceType, count: 1 });
    }

    const browsers = [...current.browsers];
    const browserIndex = browsers.findIndex((item) => item.name === browser);
    if (browserIndex >= 0) {
      browsers[browserIndex] = {
        ...browsers[browserIndex],
        count: browsers[browserIndex]!.count + 1,
      };
    } else {
      browsers.push({ name: browser, count: 1 });
    }

    const campaigns = [...current.campaigns];
    if (utmSource || utmMedium || utmCampaign) {
      const campaignIndex = campaigns.findIndex(
        (item) =>
          item.source === (utmSource || "direct") &&
          item.medium === (utmMedium || "unknown") &&
          item.campaign === (utmCampaign || "default")
      );
      if (campaignIndex >= 0) {
        campaigns[campaignIndex] = {
          ...campaigns[campaignIndex],
          count: campaigns[campaignIndex]!.count + 1,
        };
      } else {
        campaigns.push({
          source: utmSource || "direct",
          medium: utmMedium || "unknown",
          campaign: utmCampaign || "default",
          count: 1,
        });
      }
    }

    const updated: DomainTrackerStore = {
      domainId: domain.id,
      domainName: domain.domainName,
      summary: {
        pageviews: current.summary.pageviews + 1,
        uniqueVisitors: visitors.length,
        lastSeen: now,
      },
      devices: devices.sort((a, b) => b.count - a.count).slice(0, 10),
      browsers: browsers.sort((a, b) => b.count - a.count).slice(0, 10),
      campaigns: campaigns.sort((a, b) => b.count - a.count).slice(0, 10),
      pages: pages
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      referrers: referrers
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      visitors: visitors
        .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
        .slice(0, 50),
    };

    await persistDomainTracker(prisma as any, {
      domainId: domain.id,
      leadId: domain.leadId,
      tracker: updated,
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    log.api.error("Public tracker ingest failed", {
      route: "/api/public/tracker",
    }, error);
    return NextResponse.json({ success: false }, { status: 500, headers: corsHeaders });
  }
}
