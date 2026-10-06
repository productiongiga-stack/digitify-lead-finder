import { createHash } from "node:crypto";
import { prisma, setWorkspaceRlsContext, type Prisma } from "@digitify/db";
import { TRPCError } from "@trpc/server";

export type PriceSettings = {
  resolution?: string;
  quality?: string;
  duration?: number;
  aspectRatio?: string;
};
export function creativePriceKey(model: string, settings: PriceSettings) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        model,
        settings.resolution || "",
        settings.quality || "",
        settings.duration ?? null,
        settings.aspectRatio || "",
      ]),
    )
    .digest("hex");
}
export function centralCreativeEnabled() {
  return process.env.CREATIVE_CREDITS_ENABLED !== "false";
}
export function requireCentralCreativeKey() {
  const key = process.env.CREATIVE_MUAPI_KEY?.trim();
  if (!key)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Digitify moet AI-generatie nog activeren.",
    });
  return key;
}
// Financial tables are server-only: never use a caller-supplied database or user ID.
export async function quoteCreative(model: string, settings: PriceSettings) {
  const price = await prisma.creativePrice.findUnique({
    where: { key: creativePriceKey(model, settings) },
  });
  if (!price?.enabled || price.credits <= 0)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Deze combinatie heeft nog geen creditprijs. Kies een andere instelling.",
    });
  return price.credits;
}
export async function reserveCreativeJob(
  data: Prisma.MediaGenerationUncheckedCreateInput,
  requestKey?: string,
  draftId?: string,
) {
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const amount = await quoteCreative(data.model, metadata as PriceSettings);
  if (metadata.expectedCredits !== amount)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "De creditprijs is gewijzigd. Controleer de nieuwe prijs voordat je opnieuw start.",
    });
  requireCentralCreativeKey();
  return prisma.$transaction(async (tx) => {
    await setWorkspaceRlsContext(tx, data.workspaceId, data.userId);
    let draft = null;
    if (draftId) {
      await tx.$queryRaw`SELECT id FROM creative_drafts WHERE id = ${draftId} FOR UPDATE`;
      draft = await tx.creativeDraft.findFirst({
        where: {
          id: draftId,
          userId: data.userId,
          workspaceId: data.workspaceId,
        },
      });
      if (!draft)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Concept niet gevonden.",
        });
      if (draft.jobId) {
        const active = await tx.mediaGeneration.findUnique({
          where: { id: draft.jobId },
          select: { status: true },
        });
        if (active?.status === "PENDING" || active?.status === "PROCESSING")
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Er loopt al een generatie voor dit concept. Wacht op het resultaat.",
          });
      }
    }
    await tx.creativeWallet.upsert({
      where: { userId: data.userId },
      create: { userId: data.userId },
      update: {},
    });
    // Serialize requests on the user's wallet, including retries of the same submission.
    await tx.$queryRaw`SELECT "userId" FROM creative_wallets WHERE "userId" = ${data.userId} FOR UPDATE`;
    if (requestKey) {
      const previous = await tx.creativeLedger.findUnique({
        where: { reference: `reserve:${data.userId}:${requestKey}` },
      });
      if (previous)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Deze generatie is al gestart. Open je bibliotheek om het resultaat te bekijken.",
        });
    }
    const changed = await tx.creativeWallet.updateMany({
      where: { userId: data.userId, available: { gte: amount } },
      data: {
        available: { decrement: amount },
        reserved: { increment: amount },
      },
    });
    if (!changed.count)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Onvoldoende credits. Koop eerst een bundel.",
      });
    const job = await tx.mediaGeneration.create({
      data: {
        ...data,
        metadata: {
          ...metadata,
          provider: "central",
          creditCost: amount,
        } as Prisma.InputJsonObject,
      },
    });
    if (draft) {
      const state = draft.state as Record<string, unknown>;
      const kind = String(
        state.generatorType ||
          (data.type === "VIDEO"
            ? "video"
            : data.type === "MARKETING_AD"
              ? "ads"
              : data.type === "LIP_SYNC"
                ? "lipsync"
                : "images"),
      );
      const fields =
        state.fields && typeof state.fields === "object"
          ? (state.fields as Record<string, unknown>)
          : {};
      // Job links are server state, not a user edit: preserve the input revision.
      await tx.creativeDraft.update({
        where: { id: draft.id },
        data: {
          jobId: job.id,
          state: {
            ...state,
            fields: { ...fields, [`${kind}:jobId`]: job.id },
          } as Prisma.InputJsonObject,
        },
      });
    }
    await tx.creativeReservation.create({
      data: {
        jobId: job.id,
        userId: data.userId,
        workspaceId: data.workspaceId,
        amount,
      },
    });
    await tx.creativeLedger.create({
      data: {
        userId: data.userId,
        workspaceId: data.workspaceId,
        kind: "RESERVE",
        amount: -amount,
        reference: `reserve:${data.userId}:${requestKey || job.id}`,
      },
    });
    return job;
  });
}
export async function settleCreativeJob(jobId: string, success: boolean) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creativeReservation.findUnique({
      where: { jobId },
    });
    if (!reservation || reservation.status !== "RESERVED") return;
    const changed = await tx.creativeReservation.updateMany({
      where: { jobId, status: "RESERVED" },
      data: { status: success ? "CHARGED" : "RELEASED" },
    });
    if (!changed.count) return;
    await tx.creativeWallet.update({
      where: { userId: reservation.userId },
      data: {
        reserved: { decrement: reservation.amount },
        ...(success ? {} : { available: { increment: reservation.amount } }),
      },
    });
    await tx.creativeLedger.create({
      data: {
        userId: reservation.userId,
        workspaceId: reservation.workspaceId,
        kind: success ? "CHARGE" : "RELEASE",
        amount: success ? -reservation.amount : reservation.amount,
        reference: `settle:${jobId}`,
      },
    });
  });
}
export async function settleTerminalCreativeJobs(userId?: string) {
  const reservations = await prisma.creativeReservation.findMany({
    where: { status: "RESERVED", ...(userId ? { userId } : {}) },
    take: 100,
  });
  for (const reservation of reservations) {
    const job = await prisma.$transaction(async (tx) => {
      await setWorkspaceRlsContext(
        tx,
        reservation.workspaceId,
        reservation.userId,
      );
      return tx.mediaGeneration.findUnique({
        where: { id: reservation.jobId },
        select: { status: true },
      });
    });
    if (job?.status === "COMPLETED" || job?.status === "FAILED")
      await settleCreativeJob(reservation.jobId, job.status === "COMPLETED");
  }
}
