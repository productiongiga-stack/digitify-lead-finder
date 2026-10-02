import type { Prisma, PrismaClient } from "@digitify/db";
import { setWorkspaceRlsContext } from "@digitify/db";
import { checkPassword, decryptFactor, encryptFactor, factorStep, makeFactor, opaqueToken, recoveryCodes, recoveryHash, tokenHash, upgradedPassword } from "./two-factor-crypto";

type Tx = Prisma.TransactionClient;
type User = Prisma.UserGetPayload<Record<string, never>>;
type UserTwoFactor = Prisma.UserTwoFactorGetPayload<Record<string, never>>;
export class FactorError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const invalid = () => new FactorError("Ongeldige inloggegevens.", 401);
const expired = () => new FactorError("Deze controle is verlopen. Begin opnieuw.", 401);
const limited = () => new FactorError("Te veel pogingen. Probeer over vijftien minuten opnieuw.", 429);

// Private authentication DAL. Only verified identities or unguessable challenges
// may call this; never use a userId from a public request as authority.
export async function personalAuth<T>(db: PrismaClient, userId: string, run: (tx: Tx, user: User, factor: UserTwoFactor) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw invalid();
    await setWorkspaceRlsContext(tx, user.workspaceOwnerId || user.id, user.id);
    const factor = await tx.userTwoFactor.upsert({ where: { userId }, create: { userId }, update: {} });
    return run(tx, user, factor);
  });
}
export async function authRateLimit(db: PrismaClient, key: string, limit: number, windowMs = 15 * 60000) {
  const hashedKey = tokenHash(key);
  const now = new Date(), expiresAt = new Date(now.getTime() + windowMs);
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO auth_rate_buckets (key, count, "expiresAt") VALUES (${hashedKey}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN auth_rate_buckets."expiresAt" <= ${now} THEN 1 ELSE auth_rate_buckets.count + 1 END,
      "expiresAt" = CASE WHEN auth_rate_buckets."expiresAt" <= ${now} THEN ${expiresAt} ELSE auth_rate_buckets."expiresAt" END
    RETURNING count`;
  if ((rows[0]?.count ?? limit + 1) > limit) throw limited();
}
async function audit(tx: Tx, user: User, action: string, result: "SUCCESS" | "FAILED" = "SUCCESS") {
  await tx.securityAuditEvent.create({ data: { actorUserId: user.id, targetUserId: user.id, workspaceId: user.workspaceOwnerId || user.id, action, result, resource: "two_factor" } });
}
async function secondFactor(tx: Tx, user: User, factor: UserTwoFactor, code: string, method: string) {
  const now = new Date();
  const recent = factor.failureWindowAt && now.getTime() - factor.failureWindowAt.getTime() < 15 * 60000;
  if (recent && factor.failures >= 10) return limited();
  let valid = false;
  if (method === "recovery") {
    const claimed = await tx.twoFactorRecoveryCode.updateMany({ where: { userId: user.id, codeHash: recoveryHash(user.id, code), usedAt: null }, data: { usedAt: now } });
    valid = claimed.count === 1;
    if (valid) await audit(tx, user, "TWO_FACTOR_RECOVERY_CODE_USED");
  } else if (factor.secret) {
    const step = await factorStep(decryptFactor(factor.secret, user.id), code, factor.lastUsedStep);
    if (step !== null) {
      await tx.userTwoFactor.update({ where: { userId: user.id }, data: { lastUsedStep: step } });
      valid = true;
    }
  }
  if (!valid) {
    await tx.userTwoFactor.update({ where: { userId: user.id }, data: { failures: recent ? { increment: 1 } : 1, failureWindowAt: recent ? factor.failureWindowAt : now } });
    await audit(tx, user, "TWO_FACTOR_REJECTED", "FAILED");
    return new FactorError("Code ongeldig of al gebruikt. Gebruik een nieuwe code.", 401);
  }
  return null;
}
function requirePassword(user: User, password: string) {
  if (!user.passwordHash || !checkPassword(password, user.passwordHash)) throw invalid();
}

export async function beginLogin(db: PrismaClient, email: string, password: string) {
  const found = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  if (!found) { checkPassword(password, "00:" + "0".repeat(128)); throw invalid(); }
  return personalAuth(db, found.id, async (tx, user) => {
    requirePassword(user, password);
    if (user.twoFactorRecoveryRequired) throw new FactorError("Dit account wacht op gecontroleerd beveiligingsherstel.", 401);
    if (!user.emailVerified) {
      if (!["OWNER", "ADMIN"].includes(user.role)) throw invalid();
      await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    }
    if (!user.passwordHash!.includes(":")) await tx.user.update({ where: { id: user.id }, data: { passwordHash: upgradedPassword(password) } });
    const token = opaqueToken();
    await tx.loginChallenge.create({ data: { userId: user.id, tokenHash: tokenHash(token), sessionVersion: user.sessionVersion, requiresTwoFactor: user.twoFactorEnabled, expiresAt: new Date(Date.now() + 5 * 60000) } });
    return { token, requiresTwoFactor: user.twoFactorEnabled };
  });
}
export async function finishLogin(db: PrismaClient, token: string, code = "", method = "totp") {
  if (!/^[\w-]{43}$/.test(token)) throw expired();
  const found = await db.loginChallenge.findUnique({ where: { tokenHash: tokenHash(token) }, select: { userId: true } });
  if (!found) throw expired();
  const result = await personalAuth(db, found.userId, async (tx, user, factor) => {
    const challenge = await tx.loginChallenge.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!challenge || challenge.purpose !== "LOGIN" || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5 || challenge.sessionVersion !== user.sessionVersion || challenge.requiresTwoFactor !== user.twoFactorEnabled || !user.emailVerified || user.twoFactorRecoveryRequired) return { error: expired() };
    await tx.loginChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    if (user.twoFactorEnabled) {
      const error = await secondFactor(tx, user, factor, code, method);
      if (error) return { error };
    }
    await tx.loginChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
    await audit(tx, user, "LOGIN_COMPLETED");
    return { user };
  });
  if (result.error) throw result.error;
  return result.user!;
}

export async function factorStatus(db: PrismaClient, userId: string) {
  return personalAuth(db, userId, async (tx, user, factor) => ({ enabled: user.twoFactorEnabled, enabledAt: factor.enabledAt, recoveryCodesRemaining: await tx.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } }) }));
}
export async function beginFactorSetup(db: PrismaClient, userId: string, password: string, code = "", method = "totp") {
  const result = await personalAuth(db, userId, async (tx, user, factor) => {
    requirePassword(user, password);
    if (user.twoFactorRecoveryRequired) throw expired();
    if (user.twoFactorEnabled) {
      const error = await secondFactor(tx, user, factor, code, method);
      if (error) return { error };
    }
    const created = makeFactor(user.email);
    await tx.userTwoFactor.update({ where: { userId }, data: { pendingSecret: encryptFactor(created.secret, userId), pendingExpiresAt: new Date(Date.now() + 20 * 60000), pendingVersion: user.sessionVersion, pendingProofHash: null, pendingCodeHashes: PrismaNull(), pendingStep: null } });
    return created;
  });
  if ("error" in result) throw result.error;
  return result;
}
// Prisma DbNull is loaded directly: JSON null must not be an accidental omitted update.
import { Prisma as PrismaValues } from "@digitify/db";
const PrismaNull = () => PrismaValues.DbNull;

export async function verifyFactorSetup(db: PrismaClient, userId: string, code: string, recoveryToken?: string) {
  const result = await personalAuth(db, userId, async (tx, user, factor) => {
    if (recoveryToken) await requireRecoveryChallenge(tx, user, recoveryToken);
    else if (user.twoFactorRecoveryRequired) throw expired();
    if (!factor.pendingSecret || !factor.pendingExpiresAt || factor.pendingExpiresAt <= new Date() || factor.pendingVersion !== user.sessionVersion || factor.pendingProofHash) throw expired();
    const recent = factor.failureWindowAt && Date.now() - factor.failureWindowAt.getTime() < 15 * 60000;
    if (recent && factor.failures >= 10) return { error: limited() };
    const step = await factorStep(decryptFactor(factor.pendingSecret, userId), code);
    if (step === null) {
      await tx.userTwoFactor.update({ where: { userId }, data: { failures: recent ? { increment: 1 } : 1, failureWindowAt: recent ? factor.failureWindowAt : new Date() } });
      await audit(tx, user, "TWO_FACTOR_SETUP_REJECTED", "FAILED");
      return { error: new FactorError("Authenticatorcode ongeldig.", 401) };
    }
    const codes = recoveryCodes(), proof = opaqueToken();
    await tx.userTwoFactor.update({ where: { userId }, data: { pendingProofHash: tokenHash(proof), pendingCodeHashes: codes.map((c) => recoveryHash(userId, c)), pendingStep: step } });
    return { codes, proof };
  });
  if ("error" in result) throw result.error;
  return result;
}
export async function confirmFactorSetup(db: PrismaClient, userId: string, proof: string, recoveryToken?: string) {
  await personalAuth(db, userId, async (tx, user, factor) => {
    if (recoveryToken) await requireRecoveryChallenge(tx, user, recoveryToken);
    else if (user.twoFactorRecoveryRequired) throw expired();
    if (!factor.pendingSecret || !factor.pendingExpiresAt || factor.pendingExpiresAt <= new Date() || factor.pendingVersion !== user.sessionVersion || factor.pendingProofHash !== tokenHash(proof) || !Array.isArray(factor.pendingCodeHashes)) throw expired();
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.twoFactorRecoveryCode.createMany({ data: factor.pendingCodeHashes.map((h) => ({ userId, codeHash: String(h) })) });
    await tx.userTwoFactor.update({ where: { userId }, data: { secret: factor.pendingSecret, enabledAt: new Date(), lastUsedStep: factor.pendingStep ?? -1n, pendingSecret: null, pendingExpiresAt: null, pendingVersion: null, pendingProofHash: null, pendingCodeHashes: PrismaNull(), pendingStep: null } });
    await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, twoFactorRecoveryRequired: false, sessionVersion: { increment: 1 } } });
    await audit(tx, user, user.twoFactorEnabled ? "TWO_FACTOR_REPLACED" : "TWO_FACTOR_ENABLED");
    if (recoveryToken) await tx.loginChallenge.update({ where: { tokenHash: tokenHash(recoveryToken) }, data: { usedAt: new Date() } });
  });
}
export async function manageFactor(db: PrismaClient, userId: string, password: string, code: string, method: string, action: "disable" | "regenerate") {
  const result = await personalAuth(db, userId, async (tx, user, factor) => {
    requirePassword(user, password);
    if (!user.twoFactorEnabled || user.twoFactorRecoveryRequired) throw expired();
    const error = await secondFactor(tx, user, factor, code, method);
    if (error) return { error };
    const codes = action === "regenerate" ? recoveryCodes() : [];
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    if (codes.length) await tx.twoFactorRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: recoveryHash(userId, c) })) });
    await tx.userTwoFactor.update({ where: { userId }, data: { ...(action === "disable" ? { secret: null, enabledAt: null, lastUsedStep: -1n } : {}), pendingSecret: null, pendingProofHash: null, pendingCodeHashes: PrismaNull(), pendingExpiresAt: null } });
    await tx.user.update({ where: { id: userId }, data: { ...(action === "disable" ? { twoFactorEnabled: false } : {}), sessionVersion: { increment: 1 } } });
    await audit(tx, user, action === "disable" ? "TWO_FACTOR_DISABLED" : "TWO_FACTOR_CODES_REGENERATED");
    return { codes };
  });
  if ("error" in result) throw result.error;
  return result;
}

async function requireRecoveryChallenge(tx: Tx, user: User, token: string) {
  const challenge = await tx.loginChallenge.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!user.twoFactorRecoveryRequired || !challenge || challenge.userId !== user.id || challenge.purpose !== "RECOVERY_SETUP" || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.sessionVersion !== user.sessionVersion) throw expired();
}
export async function beginControlledRecovery(db: PrismaClient, email: string, password: string, grantToken: string) {
  const found = await db.twoFactorRecoveryGrant.findUnique({ where: { tokenHash: tokenHash(grantToken) }, select: { userId: true } });
  if (!found) throw invalid();
  return personalAuth(db, found.userId, async (tx, user) => {
    requirePassword(user, password);
    const grant = await tx.twoFactorRecoveryGrant.findUnique({ where: { tokenHash: tokenHash(grantToken) } });
    if (user.email !== email.trim().toLowerCase() || !user.twoFactorRecoveryRequired || !grant || grant.usedAt || grant.expiresAt <= new Date() || grant.sessionVersion !== user.sessionVersion) throw invalid();
    const setup = makeFactor(user.email), token = opaqueToken();
    await tx.twoFactorRecoveryGrant.update({ where: { id: grant.id }, data: { usedAt: new Date() } });
    await tx.userTwoFactor.update({ where: { userId: user.id }, data: { pendingSecret: encryptFactor(setup.secret, user.id), pendingExpiresAt: new Date(Date.now() + 20 * 60000), pendingVersion: user.sessionVersion, pendingProofHash: null, pendingCodeHashes: PrismaNull(), pendingStep: null } });
    await tx.loginChallenge.create({ data: { tokenHash: tokenHash(token), purpose: "RECOVERY_SETUP", userId: user.id, sessionVersion: user.sessionVersion, requiresTwoFactor: true, expiresAt: new Date(Date.now() + 20 * 60000) } });
    await audit(tx, user, "TWO_FACTOR_CONTROLLED_RECOVERY_STARTED");
    return { ...setup, token };
  });
}
export async function recoveryChallengeUser(db: PrismaClient, token: string) {
  if (!/^[\w-]{43}$/.test(token)) throw expired();
  const found = await db.loginChallenge.findUnique({ where: { tokenHash: tokenHash(token) }, select: { userId: true } });
  if (!found) throw expired();
  return found.userId;
}
export async function issueRecoveryGrant(db: PrismaClient, userId: string, input: { operatorId: string; ticket: string; reason: string; secondReviewerId?: string }) {
  return personalAuth(db, userId, async (tx, user) => {
    if (!input.operatorId.trim() || !input.ticket.trim() || !input.reason.trim()) throw new FactorError("Operator, dossier en reden zijn verplicht.");
    if (["OWNER", "ADMIN"].includes(user.role) && (!input.secondReviewerId?.trim() || input.secondReviewerId === input.operatorId)) throw new FactorError("Dit account vereist een onafhankelijke tweede controle.");
    if (!user.twoFactorEnabled && !user.twoFactorRecoveryRequired) throw new FactorError("Dit account heeft geen authenticator om te herstellen.");
    const token = opaqueToken(), sessionVersion = user.sessionVersion + 1;
    await tx.user.update({ where: { id: userId }, data: { sessionVersion, twoFactorRecoveryRequired: true } });
    await tx.loginChallenge.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.twoFactorRecoveryGrant.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.userTwoFactor.update({ where: { userId }, data: { pendingSecret: null, pendingExpiresAt: null, pendingProofHash: null, pendingCodeHashes: PrismaNull(), failures: 0, failureWindowAt: null } });
    await tx.twoFactorRecoveryGrant.create({ data: { userId, sessionVersion, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 24 * 3600000), operatorId: input.operatorId, ticket: input.ticket, reason: input.reason } });
    await tx.securityAuditEvent.create({ data: { actorUserId: input.operatorId, targetUserId: userId, workspaceId: user.workspaceOwnerId || userId, action: "TWO_FACTOR_RECOVERY_GRANTED", result: "SUCCESS", resource: "two_factor", metadata: { ticket: input.ticket, reason: input.reason, secondReviewerId: input.secondReviewerId ?? null, identityVerified: true } } });
    return token;
  });
}
