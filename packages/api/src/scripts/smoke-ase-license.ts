/**
 * Local smoke for ASE license create → HTTP activate/validate → revoke.
 * Run from repo root:
 *   ./node_modules/.pnpm/node_modules/.bin/tsx packages/api/src/scripts/smoke-ase-license.ts
 */
import { prisma } from "@digitify/db";
import {
  createLicenseForEmail,
  issueLicense,
  activateLicense,
  validateLicense,
  deactivateLicense,
} from "../lib/ase-license";
import { sendLicenseKeyEmail } from "../lib/ase-license-email";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";

async function postPublic(path: string, body: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

async function main() {
  const created = await createLicenseForEmail({
    email: "smoke-owner@example.com",
    name: "Owner Smoke",
    siteUrl: "https://client.example.com",
  });
  if (!created.ok) throw new Error(`create failed: ${created.error}`);

  const mail = await sendLicenseKeyEmail(prisma, {
    toEmail: created.license.email,
    name: created.license.name,
    key: created.key,
    userId: "smoke",
  });

  const act = await activateLicense(created.key, "https://client.example.com");
  if (!act.ok) throw new Error(`activate failed: ${JSON.stringify(act)}`);

  const ok = await validateLicense(created.key, "https://client.example.com");
  if (!ok.ok) throw new Error(`validate failed: ${JSON.stringify(ok)}`);

  const bad = await validateLicense(created.key, "https://other.example.com");
  if (bad.ok || bad.error !== "domain_mismatch") {
    throw new Error(`expected domain_mismatch, got ${JSON.stringify(bad)}`);
  }

  const deact = await deactivateLicense(created.key, "https://client.example.com");
  if (!deact.ok) throw new Error(`deactivate failed`);

  // HTTP path (WordPress plugin contract)
  const httpKey = await createLicenseForEmail({
    email: "http-smoke@example.com",
    siteUrl: "https://http-client.example.com",
  });
  if (!httpKey.ok) throw new Error(`http create failed`);

  const httpAct = await postPublic("/api/public/ase-license/activate", {
    key: httpKey.key,
    siteUrl: "https://http-client.example.com",
  });
  const httpVal = await postPublic("/api/public/ase-license/validate", {
    key: httpKey.key,
    siteUrl: "https://http-client.example.com",
  });
  const httpBad = await postPublic("/api/public/ase-license/validate", {
    key: "ASE-DEAD-BEEF-0000-0000",
    siteUrl: "https://http-client.example.com",
  });

  await prisma.aseLicense.update({
    where: { id: httpKey.license.id },
    data: { status: "revoked" },
  });
  const httpRevoked = await postPublic("/api/public/ase-license/validate", {
    key: httpKey.key,
    siteUrl: "https://http-client.example.com",
  });

  const pending = await prisma.aseLicense.findFirst({
    where: { email: "smoke-request@example.com", status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  let issuePending: Record<string, unknown> = { ok: false };
  if (pending) {
    const issued = await issueLicense(pending.id);
    if (!issued.ok) throw new Error(`issue failed: ${issued.error}`);
    const mail2 = await sendLicenseKeyEmail(prisma, {
      toEmail: issued.license.email,
      name: issued.license.name,
      key: issued.key,
      userId: "smoke",
    });
    issuePending = {
      ok: true,
      keyPrefix: issued.key.slice(0, 12),
      emailSent: mail2.success,
    };
  }

  console.log(
    JSON.stringify(
      {
        createOk: true,
        keyPrefix: created.key.slice(0, 12),
        emailSent: mail.success,
        emailError: mail.error || null,
        activateOk: act.ok,
        validateOk: ok.ok,
        domainMismatch: bad.error,
        deactivateOk: deact.ok,
        httpActivate: { status: httpAct.status, ok: httpAct.json.ok },
        httpValidate: { status: httpVal.status, ok: httpVal.json.ok },
        httpInvalid: { status: httpBad.status, error: httpBad.json.error },
        httpRevoked: { status: httpRevoked.status, error: httpRevoked.json.error },
        issuePending,
      },
      null,
      2,
    ),
  );

  if (!httpAct.json.ok || !httpVal.json.ok) {
    throw new Error("HTTP activate/validate failed");
  }
  if (httpBad.status !== 404 || httpBad.json.error !== "invalid_key") {
    throw new Error("expected invalid_key 404");
  }
  if (httpRevoked.json.error !== "revoked") {
    throw new Error("expected revoked after revoke");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
