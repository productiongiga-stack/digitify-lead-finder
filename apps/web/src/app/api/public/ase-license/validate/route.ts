import { NextResponse } from "next/server";
import { validateLicense } from "@digitify/api/src/lib/ase-license";
import { enforceRateLimit } from "@/lib/http-security";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, {
    key: "ase-license-validate",
    limit: 60,
    windowMs: 60 * 60 * 1000,
    message: "Te veel validate-calls.",
  });
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const key = String(body.key || body.licenseKey || "").trim();
  const siteUrl = String(body.siteUrl || body.site_url || "").trim();
  if (!key || !siteUrl) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const result = await validateLicense(key, siteUrl);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status || 400 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ase-license/validate]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
