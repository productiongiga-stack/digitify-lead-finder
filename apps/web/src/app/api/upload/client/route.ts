import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/http-security";
import {
  UPLOAD_ALLOWED_IMAGE_TYPES,
  UPLOAD_ALLOWED_VIDEO_TYPES,
  maxUploadBytesForPathname,
} from "@/lib/upload-constants";
import { log } from "@digitify/api/src/lib/logger";
import { blobConfigurationMessage, getBlobToken, translateBlobError } from "@digitify/api/src/lib/blob-storage";

const ALLOWED_TYPES = [...UPLOAD_ALLOWED_IMAGE_TYPES, ...UPLOAD_ALLOWED_VIDEO_TYPES];

export async function GET() {
  const currentUser = await getCurrentUser();
  const userId = currentUser && typeof currentUser.id === "string" ? currentUser.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }

  if (!getBlobToken("public")) {
    return NextResponse.json({ configured: false, prefix: null });
  }

  return NextResponse.json({
    configured: true,
    prefix: `workspaces/${userId}/`,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const currentUser = await getCurrentUser();
  const userId = currentUser && typeof currentUser.id === "string" ? currentUser.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }

  const limiter = await enforceRateLimit(request, {
    key: `upload-client:${userId}`,
    limit: 80,
    windowMs: 60 * 60 * 1000,
    message: "Te veel uploads. Probeer later opnieuw.",
  });
  if (limiter) return limiter;

  if (!getBlobToken("public")) {
    return NextResponse.json(
      { error: blobConfigurationMessage("public") },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      token: getBlobToken("public"),
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const expectedPrefix = `workspaces/${userId}/`;
        if (!pathname.startsWith(expectedPrefix) || pathname.includes("..")) {
          throw new Error("Ongeldig uploadpad.");
        }

        return {
          allowedContentTypes: [...ALLOWED_TYPES],
          maximumSizeInBytes: maxUploadBytesForPathname(pathname),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        log.api.info("Client blob upload completed", {
          userId,
          url: blob.url,
          tokenPayload,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = translateBlobError(error, "public").message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
