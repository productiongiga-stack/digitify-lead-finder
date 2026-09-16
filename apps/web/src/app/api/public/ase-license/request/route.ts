import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import {
  createLicenseRequest,
  isAseLicenseUnavailableError,
} from "@digitify/api/src/lib/ase-license";
import { notifyOwnersOfLicenseRequest } from "@digitify/api/src/lib/ase-license-email";
import { enforceRateLimit } from "@/lib/http-security";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, {
    key: "ase-license-request",
    limit: 8,
    windowMs: 60 * 60 * 1000,
    message: "Te veel aanvragen. Probeer later opnieuw.",
  });
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  const name = String(body.name || "").trim();
  const siteUrl = String(body.siteUrl || body.site_url || "").trim();
  const message = String(body.message || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    const row = await createLicenseRequest({ email, name, siteUrl, message });
    // Fire-and-forget owner notify — never fail the public request on mail issues.
    void notifyOwnersOfLicenseRequest(prisma, {
      id: row.id,
      email: row.email,
      name: row.name,
      siteUrl: row.siteUrl,
      message: row.message,
    }).catch((err) => {
      console.error("[ase-license/request] notify failed", err instanceof Error ? err.message : err);
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      message: "Aanvraag ontvangen. Digitify stuurt je een license key na goedkeuring.",
    });
  } catch (err) {
    if (isAseLicenseUnavailableError(err)) {
      console.error("[ase-license/request] schema missing — run migrate deploy");
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    console.error("[ase-license/request]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
