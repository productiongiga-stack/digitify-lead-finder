import { prisma } from "@digitify/db";
import { log } from "@digitify/api/src/lib/logger";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=",
  "base64",
);

function gifResponse() {
  return new Response(PIXEL_GIF, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, max-age=0",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);
  const { id } = await context.params;
  const limiter = await enforceRateLimit(request, {
    key: `public-email-open:${id}:${ip}`,
    limit: 2400,
    windowMs: 60 * 60 * 1000,
    message: "rate_limited",
  });
  if (limiter) return gifResponse();

  if (!id || id.length > 100) return gifResponse();

  try {
    const updated = await prisma.emailDraft.updateMany({
      where: {
        id,
        status: "SENT",
        openedAt: null,
      },
      data: { openedAt: new Date() },
    });
    if (updated.count > 0) {
      const draft = await prisma.emailDraft.findUnique({
        where: { id },
        select: { id: true, leadId: true, authorId: true, toEmail: true },
      });
      if (draft?.leadId && draft.authorId) {
        await prisma.activity.create({
          data: {
            leadId: draft.leadId,
            userId: draft.authorId,
            type: "EMAIL_OPENED",
            title: `E-mail geopend door ${draft.toEmail}`,
            metadata: { draftId: draft.id, source: "tracking_pixel" },
          },
        });
      }
    }
  } catch (error) {
    log.email.warn("Email open tracking failed", { draftId: id }, error);
  }

  return gifResponse();
}
