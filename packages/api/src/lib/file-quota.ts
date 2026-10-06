import { Prisma, type PrismaClient } from "@digitify/db";
import { DEFAULT_USER_FILE_QUOTA_BYTES } from "./file-storage";

export type FileQuotaSummary = {
  quotaBytes: bigint;
  usedBytes: bigint;
  reservedBytes: bigint;
  remainingBytes: bigint;
};

async function ensureQuota(db: PrismaClient, userId: string, workspaceId: string) {
  return db.userFileQuota.upsert({
    where: { userId_workspaceId: { userId, workspaceId } },
    update: {},
    create: { userId, workspaceId, quotaBytes: BigInt(DEFAULT_USER_FILE_QUOTA_BYTES) },
  });
}

export async function getFileQuota(db: PrismaClient, userId: string, workspaceId: string): Promise<FileQuotaSummary> {
  const quota = await ensureQuota(db, userId, workspaceId);
  return {
    quotaBytes: quota.quotaBytes,
    usedBytes: quota.usedBytes,
    reservedBytes: quota.reservedBytes,
    remainingBytes: quota.quotaBytes - quota.usedBytes - quota.reservedBytes,
  };
}

export async function reserveFileQuota(db: PrismaClient, params: {
  userId: string;
  workspaceId: string;
  bytes: number;
  idempotencyKey: string;
}) {
  const bytes = BigInt(params.bytes);
  return db.$transaction(async (tx) => {
    const existing = await tx.fileStorageReservation.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
    if (existing) return existing;
    await tx.userFileQuota.upsert({
      where: { userId_workspaceId: { userId: params.userId, workspaceId: params.workspaceId } },
      update: {},
      create: { userId: params.userId, workspaceId: params.workspaceId, quotaBytes: BigInt(DEFAULT_USER_FILE_QUOTA_BYTES) },
    });
    const rows = await tx.$queryRaw<Array<{ quotaBytes: bigint; usedBytes: bigint; reservedBytes: bigint }>>(Prisma.sql`
      SELECT "quotaBytes", "usedBytes", "reservedBytes"
      FROM "user_file_quotas"
      WHERE "userId" = ${params.userId} AND "workspaceId" = ${params.workspaceId}
      FOR UPDATE
    `);
    const quota = rows[0];
    if (!quota || quota.quotaBytes - quota.usedBytes - quota.reservedBytes < bytes) {
      throw new Error("Je lokale opslaglimiet is bereikt. Verwijder een bestand of kies Google Drive.");
    }
    const reservation = await tx.fileStorageReservation.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        idempotencyKey: params.idempotencyKey,
        bytes,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    await tx.userFileQuota.update({
      where: { userId_workspaceId: { userId: params.userId, workspaceId: params.workspaceId } },
      data: { reservedBytes: { increment: bytes }, version: { increment: 1 } },
    });
    return reservation;
  });
}

export async function commitFileQuota(db: PrismaClient, reservationId: string, fileId: string) {
  return db.$transaction(async (tx) => {
    const reservation = await tx.fileStorageReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status === "COMMITTED") return reservation;
    if (reservation.status !== "RESERVED") return reservation;
    await tx.fileStorageReservation.update({ where: { id: reservation.id }, data: { status: "COMMITTED", fileId, committedAt: new Date() } });
    await tx.userFileQuota.update({
      where: { userId_workspaceId: { userId: reservation.userId, workspaceId: reservation.workspaceId } },
      data: { reservedBytes: { decrement: reservation.bytes }, usedBytes: { increment: reservation.bytes }, version: { increment: 1 } },
    });
    return reservation;
  });
}

export async function releaseFileQuota(db: PrismaClient, reservationId: string) {
  return db.$transaction(async (tx) => {
    const reservation = await tx.fileStorageReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== "RESERVED") return reservation;
    await tx.fileStorageReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED", releasedAt: new Date() } });
    await tx.userFileQuota.update({
      where: { userId_workspaceId: { userId: reservation.userId, workspaceId: reservation.workspaceId } },
      data: { reservedBytes: { decrement: reservation.bytes }, version: { increment: 1 } },
    });
    return reservation;
  });
}

export async function releaseUsedFileQuota(db: PrismaClient, params: { userId: string; workspaceId: string; bytes: number }) {
  await ensureQuota(db, params.userId, params.workspaceId);
  return db.userFileQuota.update({
    where: { userId_workspaceId: { userId: params.userId, workspaceId: params.workspaceId } },
    data: { usedBytes: { decrement: BigInt(params.bytes) }, version: { increment: 1 } },
  });
}
