import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";
import { log } from "@digitify/api/src/lib/logger";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/webp",
];

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  const userId = typeof (currentUser as any)?.id === "string" ? (currentUser as any).id : "";
  if (!userId) {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }
  const ip = getClientIp(req);
  const limiter = await enforceRateLimit(req, {
    key: `upload:${userId}:${ip}`,
    limit: 80,
    windowMs: 60 * 60 * 1000,
    message: "Te veel uploads. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  }

  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "Bestand is te groot (max 2MB)." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Ongeldig bestandstype." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
  log.api.info("Image uploaded via data-url API", {
    userId,
    name: file.name,
    type: file.type,
    size: file.size,
  });

  return NextResponse.json({
    url: dataUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  });
}
