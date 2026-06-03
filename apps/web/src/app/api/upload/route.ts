import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";
import { storeUploadedImage } from "@/lib/upload-storage";
import { log } from "@digitify/api/src/lib/logger";

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/webp",
];

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

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
  const maxSize = isVideo ? 100 * 1024 * 1024 : 2 * 1024 * 1024;
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
