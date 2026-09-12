import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { createHash } from "node:crypto";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

const seenSubmissions = new Map<string, number>();

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json() as Record<string, unknown>;
    const tenant = String(body.tenant || "");
    const workspaceId = await resolvePublicTenantUserId(prisma, tenant);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Deze reviewwidget is niet veilig gekoppeld aan een werkruimte." },
        { status: 400 },
      );
    }

    const limiter = await enforceRateLimit(request, {
      key: `public-review-embed:${workspaceId}`,
      limit: 15,
      windowMs: 60 * 60 * 1000,
      message: "Te veel aanvragen. Probeer later opnieuw.",
    });
    if (limiter) return limiter;

    const rating = Number(body.rating);
    const feedback = String(body.feedback || "").trim().slice(0, 2000);
    const platform = String(body.platform || "").trim();
    const company = String(body.company || "").trim();
    const pageUrl = String(body.pageUrl || request.headers.get("referer") || "").trim();
    const honeypot = String(body.website || "").trim();
    const sessionScope = `${workspaceId}|${company}|${pageUrl}`.trim() || ip;
    const sessionKey = createHash("sha256").update(sessionScope).digest("hex").slice(0, 16);
    const lockCookieName = `review_embed_once_${sessionKey}`;
    const secureCookie = request.url.startsWith("https://");

    if (honeypot) {
      return NextResponse.json({ success: true });
    }

    if (getCookieValue(request, lockCookieName) === "1") {
      return NextResponse.json(
        { error: "Deze review werd in deze sessie al ingestuurd." },
        { status: 409 },
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Geef een geldige score tussen 1 en 5." }, { status: 400 });
    }

    if (rating < 4 && feedback.length < 5) {
      return NextResponse.json(
        { error: "Geef wat extra context mee zodat het team deze feedback kan opvolgen." },
        { status: 400 }
      );
    }

    const fingerprint = createHash("sha256")
      .update(`${workspaceId}|${ip}|${rating}|${feedback}|${platform}|${company}|${pageUrl}`)
      .digest("hex");
    const now = Date.now();
    for (const [key, ts] of seenSubmissions.entries()) {
      if (now - ts > 10 * 60 * 1000) seenSubmissions.delete(key);
    }
    if (seenSubmissions.has(fingerprint)) {
      return NextResponse.json(
        { error: "Deze feedback lijkt al ingestuurd." },
        { status: 409 },
      );
    }
    seenSubmissions.set(fingerprint, now);

    await prisma.activity.create({
      data: {
        userId: workspaceId,
        type: "NOTE_ADDED",
        title:
          rating >= 4
            ? `Publieke reviewwidget: ${rating} sterren${platform ? ` via ${platform}` : ""}`
            : `Publieke reviewwidget feedback: ${rating} sterren`,
        metadata: {
          source: "public_review_embed",
          rating,
          platform: platform || null,
          company: company || null,
          feedback: feedback || null,
          pageUrl: pageUrl || null,
        },
      },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(lockCookieName, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Feedback opslaan mislukt." }, { status: 500 });
  }
}
