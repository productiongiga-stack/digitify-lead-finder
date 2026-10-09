import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { mutationProcedure, protectedProcedure, router } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";
import { assertWorkspaceFileRelation } from "../lib/file-relations";
import { getFileQuota, releaseUsedFileQuota } from "../lib/file-quota";
import { readLocalWorkspaceFile, removeLocalWorkspaceFile } from "../lib/file-storage";
import { loadWorkspaceSettingRows } from "../lib/workspace-settings";
import { getGoogleDriveFileMetadata, uploadGoogleDriveFile } from "../lib/google-drive";
import { workspaceScopeFromUser } from "../lib/workspace-settings";
import { isBlobConfigured } from "../lib/blob-storage";

const relatedTypeSchema = z.enum(["LEAD", "QUOTE", "CUSTOMER", "PROJECT"]).optional();
const sortSchema = z.enum(["createdAt", "name", "size"]).default("createdAt");
const fileListInput = z.object({
  relatedType: relatedTypeSchema,
  relatedId: z.string().optional(),
  search: z.string().trim().max(160).optional(),
  storageProvider: z.enum(["LOCAL", "BLOB", "GOOGLE_DRIVE"]).optional(),
  folderId: z.string().nullable().optional(),
  includeTrash: z.boolean().default(false),
  sort: sortSchema,
  direction: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(200).default(100),
}).refine((value) => Boolean(value.relatedType) === Boolean(value.relatedId), "Bestandsrelatie is onvolledig.");

function asQuotaResponse(quota: Awaited<ReturnType<typeof getFileQuota>>) {
  return Object.fromEntries(Object.entries(quota).map(([key, value]) => [key, value.toString()]));
}

export const fileRouter = router({
  list: protectedProcedure.input(fileListInput.default({})).query(async ({ ctx, input }) => {
    const workspaceId = ctx.user.workspaceId!;
    const orderBy = input.sort === "name" ? { name: input.direction } : input.sort === "size" ? { size: input.direction } : { createdAt: input.direction };
    return ctx.db.workspaceFile.findMany({
      where: {
        createdById: ctx.user.ownerUserId!,
        ...(input.includeTrash ? { deletedAt: { not: null } } : { deletedAt: null }),
        ...(input.relatedType ? { relatedType: input.relatedType } : {}),
        ...(input.relatedId ? { relatedId: input.relatedId } : {}),
        ...(input.storageProvider ? { storageProvider: input.storageProvider } : {}),
        ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
        ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {}),
      },
      orderBy,
      take: input.limit,
      select: {
        id: true, name: true, storage: true, storageProvider: true, contentType: true, size: true,
        relatedType: true, relatedId: true, folderId: true, deletedAt: true, driveWebUrl: true,
        driveSyncStatus: true, createdAt: true, updatedAt: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }),

  storageSummary: protectedProcedure.query(async ({ ctx }) => {
    const quota = await getFileQuota(ctx.db, ctx.user.id, ctx.user.workspaceId!);
    const [localBytes, driveCount] = await Promise.all([
      ctx.db.workspaceFile.aggregate({ where: { createdById: ctx.user.ownerUserId!, uploadedById: ctx.user.id, deletedAt: null, storageProvider: { in: ["LOCAL", "BLOB"] } }, _sum: { size: true }, _count: { _all: true } }),
      ctx.db.workspaceFile.count({ where: { createdById: ctx.user.ownerUserId!, uploadedById: ctx.user.id, deletedAt: null, storageProvider: "GOOGLE_DRIVE" } }),
    ]);
    return { quota: asQuotaResponse(quota), localBytes: localBytes._sum.size ?? 0, localFileCount: localBytes._count._all, driveFileCount: driveCount, persistentLocal: process.env.NODE_ENV !== "production" || Boolean(process.env.FILES_LOCAL_ROOT?.trim()), privateBlobConfigured: isBlobConfigured("private"), publicBlobConfigured: isBlobConfigured("public") };
  }),

  folders: protectedProcedure.query(({ ctx }) => ctx.db.fileFolder.findMany({ where: { workspaceId: ctx.user.workspaceId! }, orderBy: { name: "asc" } })),

  createFolder: mutationProcedure.input(z.object({ name: z.string().trim().min(1).max(120), parentId: z.string().nullable().optional() })).mutation(async ({ ctx, input }) => {
    if (input.parentId) {
      const parent = await ctx.db.fileFolder.findFirst({ where: { id: input.parentId, workspaceId: ctx.user.workspaceId! }, select: { id: true } });
      if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Bovenliggende map niet gevonden." });
    }
    return ctx.db.fileFolder.create({ data: { workspaceId: ctx.user.workspaceId!, createdById: ctx.user.id, name: input.name, parentId: input.parentId ?? null } });
  }),

  updateMetadata: mutationProcedure.input(z.object({ id: z.string(), name: z.string().trim().min(1).max(240).optional(), folderId: z.string().nullable().optional() })).mutation(async ({ ctx, input }) => {
    const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId!, deletedAt: null }, select: { id: true } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet gevonden." });
    if (input.folderId) {
      const folder = await ctx.db.fileFolder.findFirst({ where: { id: input.folderId, workspaceId: ctx.user.workspaceId! }, select: { id: true } });
      if (!folder) throw new TRPCError({ code: "BAD_REQUEST", message: "Map niet gevonden." });
    }
    return ctx.db.workspaceFile.update({ where: { id: input.id }, data: { ...(input.name ? { name: input.name } : {}), ...(input.folderId !== undefined ? { folderId: input.folderId } : {}) }, select: { id: true, name: true, folderId: true } });
  }),

  link: mutationProcedure.input(z.object({ id: z.string(), relatedType: z.enum(["LEAD", "QUOTE", "CUSTOMER", "PROJECT"]), relatedId: z.string() })).mutation(async ({ ctx, input }) => {
    await assertWorkspaceFileRelation(ctx.db, ctx.user.workspaceId!, input.relatedType, input.relatedId);
    const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId!, deletedAt: null }, select: { id: true } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet gevonden." });
    return ctx.db.workspaceFile.update({ where: { id: input.id }, data: { relatedType: input.relatedType, relatedId: input.relatedId }, select: { id: true, relatedType: true, relatedId: true } });
  }),

  unlink: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId! }, select: { id: true } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet gevonden." });
    return ctx.db.workspaceFile.update({ where: { id: input.id }, data: { relatedType: null, relatedId: null }, select: { id: true } });
  }),

  delete: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId!, deletedAt: null }, select: { id: true, name: true } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet gevonden." });
    await ctx.db.workspaceFile.update({ where: { id: file.id }, data: { deletedAt: new Date(), trashedById: ctx.user.id } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: ctx.user.workspaceId, actorUserId: ctx.user.actorUserId ?? ctx.user.id, targetUserId: ctx.user.id, action: "FILE_TRASHED", resource: "WorkspaceFile", resourceId: file.id, result: "SUCCESS", requestId: ctx.requestId, metadata: { name: file.name } });
    return { ok: true };
  }),

  restore: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId!, deletedAt: { not: null } }, select: { id: true } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet in de prullenbak." });
    return ctx.db.workspaceFile.update({ where: { id: input.id }, data: { deletedAt: null, trashedById: null }, select: { id: true } });
  }),

  emptyTrash: mutationProcedure.input(z.object({ id: z.string().optional() })).mutation(async ({ ctx, input }) => {
    if (!["OWNER", "ADMIN"].includes(ctx.user.workspaceRole ?? ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Alleen een workspace-admin kan bestanden definitief wissen." });
    const files = await ctx.db.workspaceFile.findMany({ where: { createdById: ctx.user.ownerUserId!, ...(input.id ? { id: input.id } : {}), deletedAt: { not: null } }, select: { id: true, size: true, uploadedById: true, storageProvider: true, storageKey: true } });
    await ctx.db.workspaceFile.deleteMany({ where: { id: { in: files.map((file) => file.id) }, createdById: ctx.user.ownerUserId! } });
    for (const file of files) {
      if (file.storageProvider === "LOCAL" && file.storageKey) await removeLocalWorkspaceFile(file.storageKey, ctx.user.workspaceId!);
      // Drive-only files never reserve local quota. Releasing them here would
      // make the user's local usage negative after emptying the trash.
      if (file.storageProvider === "LOCAL" || file.storageProvider === "BLOB") {
        await releaseUsedFileQuota(ctx.db, { userId: file.uploadedById, workspaceId: ctx.user.workspaceId!, bytes: file.size });
      }
    }
    return { deleted: files.length };
  }),

  driveStatus: protectedProcedure.query(async ({ ctx }) => {
    const rows = await loadWorkspaceSettingRows(ctx.db, { workspaceId: ctx.user.workspaceId!, memberId: ctx.user.id }, ["files.google_drive_refresh_token", "files.google_drive_account_email", "files.google_drive_folder_id"]);
    const values = new Map(rows.map((row) => [row.key, String(row.value ?? "")]));
    return { connected: Boolean(values.get("files.google_drive_refresh_token")), accountEmail: values.get("files.google_drive_account_email") || null, folderId: values.get("files.google_drive_folder_id") || null };
  }),

  driveImport: mutationProcedure.input(z.object({ driveFileId: z.string().trim().min(1).max(180), relatedType: z.enum(["LEAD", "QUOTE", "CUSTOMER", "PROJECT"]).optional(), relatedId: z.string().optional() })).mutation(async ({ ctx, input }) => {
    if (input.relatedType || input.relatedId) await assertWorkspaceFileRelation(ctx.db, ctx.user.workspaceId!, input.relatedType, input.relatedId);
    const existing = await ctx.db.workspaceFile.findFirst({ where: { createdById: ctx.user.ownerUserId!, driveFileId: input.driveFileId, deletedAt: null }, select: { id: true, name: true, contentType: true, size: true, createdAt: true } });
    if (existing) return { ...existing, outcome: "reused" as const };
    const metadata = await getGoogleDriveFileMetadata(ctx.db, workspaceScopeFromUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId }), input.driveFileId);
    if (!metadata.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Google Drive-bestand bestaat niet meer." });
    const record = await ctx.db.workspaceFile.create({ data: { createdById: ctx.user.ownerUserId!, uploadedById: ctx.user.id, name: (metadata.name || "Drive-bestand").slice(0, 240), storageUrl: metadata.webViewLink || `drive://${metadata.id}`, storage: "google-drive", storageProvider: "GOOGLE_DRIVE", contentType: metadata.mimeType || "application/octet-stream", size: Number(metadata.size || 0), relatedType: input.relatedType || null, relatedId: input.relatedId || null, driveFileId: metadata.id, driveWebUrl: metadata.webViewLink || null, driveEtag: metadata.etag || null, driveSyncStatus: "SYNCED" }, select: { id: true, name: true, contentType: true, size: true, createdAt: true } });
    return { ...record, outcome: "created" as const };
  }),

  driveCopy: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId!, deletedAt: null }, select: { id: true, name: true, contentType: true, storageProvider: true, storageKey: true, storageUrl: true, driveFileId: true } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet gevonden." });
    if (file.driveFileId) return { id: file.id, outcome: "reused" as const };
    const bytes = file.storageProvider === "LOCAL" && file.storageKey ? await readLocalWorkspaceFile(file.storageKey, ctx.user.workspaceId!) : Buffer.from(await (await fetch(file.storageUrl)).arrayBuffer());
    const driveFile = await uploadGoogleDriveFile(ctx.db, workspaceScopeFromUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId }), { name: file.name, contentType: file.contentType, bytes });
    const updated = await ctx.db.workspaceFile.update({ where: { id: file.id }, data: { driveFileId: driveFile.id, driveWebUrl: driveFile.webViewLink || null, driveEtag: driveFile.etag || null, driveSyncStatus: "SYNCED" }, select: { id: true, driveFileId: true, driveWebUrl: true } });
    return { ...updated, outcome: "created" as const };
  }),

  driveRetry: mutationProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const file = await ctx.db.workspaceFile.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId!, deletedAt: null }, select: { id: true, name: true, contentType: true, storageProvider: true, storageKey: true, storageUrl: true } });
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Bestand niet gevonden." });
    const bytes = file.storageProvider === "LOCAL" && file.storageKey ? await readLocalWorkspaceFile(file.storageKey, ctx.user.workspaceId!) : Buffer.from(await (await fetch(file.storageUrl)).arrayBuffer());
    const driveFile = await uploadGoogleDriveFile(ctx.db, workspaceScopeFromUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId }), { name: file.name, contentType: file.contentType, bytes });
    const updated = await ctx.db.workspaceFile.update({ where: { id: file.id }, data: { driveFileId: driveFile.id, driveWebUrl: driveFile.webViewLink || null, driveEtag: driveFile.etag || null, driveSyncStatus: "SYNCED", lastError: null }, select: { id: true, driveFileId: true, driveWebUrl: true } });
    return { ...updated, outcome: "created" as const };
  }),
});
