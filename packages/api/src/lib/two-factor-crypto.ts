import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";

export const ISSUER = "Digitify Lead Finder";
export const opaqueToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const recoveryHash = (userId: string, code: string) => tokenHash(userId + ":" + code.replace(/[\s-]/g, "").toUpperCase());
export function recoveryCodes() { return Array.from({ length: 10 }, () => randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g)!.join("-")); }

function encryptionKey() {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error("2FA-encryptiesleutel ontbreekt of is ongeldig.");
  return Buffer.from(key, "hex");
}
export function encryptFactor(secret: string, userId: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("digitify-2fa:v1:" + userId));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptFactor(payload: string, userId: string) {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Ongeldige 2FA-configuratie.");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  cipher.setAAD(Buffer.from("digitify-2fa:v1:" + userId));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString("utf8");
}
export function makeFactor(email: string) {
  const secret = generateSecret();
  return { secret, uri: generateURI({ issuer: ISSUER, label: email, secret, algorithm: "sha1", digits: 6, period: 30 }) };
}
export async function factorStep(secret: string, code: string, lastStep: bigint = -1n, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const result = await verify({ secret, token: code, algorithm: "sha1", digits: 6, period: 30, epoch: Math.floor(now / 1000), epochTolerance: 30 });
  if (!result.valid) return null;
  const step = BigInt(Math.floor(now / 30000) + (result.delta ?? 0));
  return step > lastStep ? step : null;
}
export function checkPassword(password: string, stored: string) {
  if (stored.includes(":")) {
    const [salt, hash] = stored.split(":");
    if (!salt || !/^[a-f0-9]{128}$/i.test(hash || "")) return false;
    return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash!, "hex"));
  }
  if (!/^[a-f0-9]{64}$/i.test(stored)) return false;
  return timingSafeEqual(Buffer.from(tokenHash(password), "hex"), Buffer.from(stored, "hex"));
}
export function upgradedPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
