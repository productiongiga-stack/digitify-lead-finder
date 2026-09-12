import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { log } from "@digitify/api/src/lib/logger";
import { applyDomainTrackerHit, persistDomainTracker, type DomainTrackerStore } from "@digitify/api/src/lib/domain-insights";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function getVisitorId(request: Request, payload: Record<string, unknown>) {
  const clientVisitorId = String(payload.visitorId || "").trim();
  if (clientVisitorId) return clientVisitorId.slice(0, 120);
  const ip = getClientIp(request);
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

    const now = new Date().toISOString();
    const visitorId = getVisitorId(request, payload);
    const referrerSource = getReferrerSource(referrer);
    const deviceType = detectDeviceType(payload);
    const browser = detectBrowser(payload);
    const outcome = await prisma.$transaction(async (tx) => {
      // A short, domain-scoped lock prevents concurrent hits from overwriting a newer snapshot.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`domain-tracker:${domainId}`}, 0))`;
      const domain = await tx.domain.findUnique({
        where: { id: domainId },
        select: {
          id: true,
          domainName: true,
          leadId: true,
          status: true,
          createdById: true,
          trackerData: true,
          lead: { select: { id: true, createdById: true } },
        },
      });

      if (!domain || domain.status !== "ACTIVE" || (domain.lead && domain.lead.createdById !== domain.createdById)) {
        return false;
      }

      const updated = applyDomainTrackerHit(domain.trackerData as DomainTrackerStore | null, {
        visitorId,
        sessionId,
        pageUrl,
        title,
        referrerSource,
        language,
        timezone,
        deviceType,
        browser,
        utmSource,
        utmMedium,
        utmCampaign,
        occurredAt: now,
      }, domain);

      await persistDomainTracker(tx, { domainId: domain.id, leadId: domain.leadId, tracker: updated });
      return true;
    });

    return NextResponse.json({ success: outcome }, { headers: corsHeaders });
  } catch (error) {
    log.api.error("Public tracker ingest failed", {
      route: "/api/public/tracker",
    }, error);
    return NextResponse.json({ success: false }, { status: 500, headers: corsHeaders });
  }
}
