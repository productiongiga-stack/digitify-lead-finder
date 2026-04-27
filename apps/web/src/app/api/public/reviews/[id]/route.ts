import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { replacePlaceholders } from "@digitify/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { REVIEW_PUBLIC_TEXT_FIELDS, getReviewTextDefault } from "@/lib/review-text";

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part) continue;
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return "";
}

function reviewLockCookieName(id: string) {
  return `review_once_${id}`;
}

function getSetting(settings: Array<{ key: string; value: unknown }>, key: string, fallback: string) {
  const row = settings.find((item) => item.key === key);
  return row ? String(row.value).replace(/^"|"$/g, "") : fallback;
}

function getPlatformLabel(platform?: string | null) {
  const platformLabels: Record<string, string> = {
    google: "Google",
    trustpilot: "Trustpilot",
    facebook: "Facebook",
  };
  return platformLabels[platform || "google"] || "Google";
}

function resolveReviewText(
  settings: Array<{ key: string; value: unknown }>,
  key: string,
  context: Record<string, string | number | undefined>
) {
  const template = getSetting(settings, key, getReviewTextDefault(key));
  return replacePlaceholders(template, context, { removeMissing: true }).replace(/\s{2,}/g, " ").trim();
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const review = await prisma.reviewRequest.findUnique({
    where: { id },
    include: { lead: { select: { companyName: true } } },
  });

  if (!review) {
    return NextResponse.json({ error: "Reviewverzoek niet gevonden." }, { status: 404 });
  }

  if (review.status === "PENDING" || review.status === "SENT") {
    await prisma.reviewRequest.update({
      where: { id },
      data: { status: "OPENED" },
    });
  }

  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "branding.company_name",
          "branding.company_slogan",
          "branding.primary_color",
          "branding.logo_url",
          ...REVIEW_PUBLIC_TEXT_FIELDS.map((field) => field.key),
        ].map((key) => userSettingKey(review.createdById, key)),
      },
    },
  });
  const scopedSettings = settings.map((row) => ({
    ...row,
    key: row.key.replace(`user:${review.createdById}:`, ""),
  }));

  const companyName = getSetting(scopedSettings, "branding.company_name", "Digitify");
  const platformLabel = getPlatformLabel(review.platform);
  const textContext = {
    clientName: review.clientName,
    companyName,
    platformLabel,
    leadCompanyName: review.lead?.companyName || "",
    selectedRating: review.rating ?? "",
  };

  return NextResponse.json({
    id: review.id,
    clientName: review.clientName,
    companyName,
    companySlogan: getSetting(scopedSettings, "branding.company_slogan", ""),
    primaryColor: getSetting(scopedSettings, "branding.primary_color", "#6366f1"),
    logoUrl: getSetting(scopedSettings, "branding.logo_url", ""),
    platform: review.platform || "google",
    platformLabel,
    reviewUrl: review.reviewUrl || "",
    leadCompanyName: review.lead?.companyName || "",
    status: review.status,
    rating: review.rating,
    feedback: review.feedback,
    texts: Object.fromEntries(
      REVIEW_PUBLIC_TEXT_FIELDS.map((field) => [
        field.key,
        resolveReviewText(scopedSettings, field.key, textContext),
      ])
    ),
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const lockCookie = reviewLockCookieName(id);
  const secureCookie = request.url.startsWith("https://");
  if (getCookieValue(request, lockCookie) === "1") {
    return NextResponse.json(
      { error: "Deze review is in deze browser al ingestuurd." },
      { status: 409 },
    );
  }

  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const limiter = checkRateLimit({
    key: `public-review:${id}:${ip}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Te veel pogingen. Wacht even en probeer opnieuw." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const rating = Number(body.rating);
  const feedback = String(body.feedback || "").trim().slice(0, 2000);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Geef een geldige score tussen 1 en 5." }, { status: 400 });
  }

  const review = await prisma.reviewRequest.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "Reviewverzoek niet gevonden." }, { status: 404 });
  }
  if (review.status === "REVIEWED" || review.status === "FEEDBACK") {
    return NextResponse.json(
      { error: "Deze beoordeling is al afgerond." },
      { status: 409 },
    );
  }

  if (rating >= 4) {
    const updated = await prisma.reviewRequest.updateMany({
      where: {
        id,
        status: { in: ["PENDING", "SENT", "OPENED"] },
      },
      data: {
        rating,
        status: "REVIEWED",
        reviewedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Deze beoordeling is al afgerond." },
        { status: 409 },
      );
    }

    const saved = await prisma.reviewRequest.findUnique({
      where: { id },
      select: { reviewUrl: true },
    });

    const response = NextResponse.json({
      success: true,
      redirectUrl: saved?.reviewUrl || null,
    });
    response.cookies.set(lockCookie, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  if (feedback.length < 5) {
    return NextResponse.json(
      { error: "Geef kort mee wat beter kon, zodat we uw feedback intern kunnen opvolgen." },
      { status: 400 }
    );
  }

  const updated = await prisma.reviewRequest.updateMany({
    where: {
      id,
      status: { in: ["PENDING", "SENT", "OPENED"] },
    },
    data: {
      rating,
      status: "FEEDBACK",
      feedback,
      feedbackSubmittedAt: new Date(),
      reviewedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Deze beoordeling is al afgerond." },
      { status: 409 },
    );
  }

  const response = NextResponse.json({ success: true, redirectUrl: null });
  response.cookies.set(lockCookie, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
