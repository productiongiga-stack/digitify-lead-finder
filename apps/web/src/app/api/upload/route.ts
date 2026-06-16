import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";
import { storeUploadedImage } from "@/lib/upload-storage";
import { UPLOAD_ALLOWED_IMAGE_TYPES, UPLOAD_ALLOWED_VIDEO_TYPES, UPLOAD_MAX_VIDEO_BYTES } from "@/lib/upload-constants";
import { log } from "@digitify/api/src/lib/logger";

const ALLOWED_IMAGE_TYPES: string[] = [...UPLOAD_ALLOWED_IMAGE_TYPES];
const ALLOWED_VIDEO_TYPES: string[] = [...UPLOAD_ALLOWED_VIDEO_TYPES];

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  const userId =
    currentUser && typeof currentUser.id === "string" ? currentUser.id : "";
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

  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  const maxSize = isVideo ? UPLOAD_MAX_VIDEO_BYTES : 2 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: isVideo ? "Video is te groot (max 100MB)." : "Bestand is te groot (max 2MB)." },
      { status: 400 },
    );
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !isVideo) {
    return NextResponse.json({ error: "Ongeldig bestandstype." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const stored = await storeUploadedImage({ userId, file, bytes });

    log.api.info("Image uploaded", {
      userId,
      name: file.name,
      type: file.type,
      size: file.size,
      storage: stored.storage,
    });

    return NextResponse.json(stored);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
