/**
 * Authenticated Eigenaar flow + public activate/validate.
 * Run: ./node_modules/.pnpm/node_modules/.bin/tsx packages/api/src/scripts/smoke-ase-license-auth.ts
 *
 * Requires SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD and a running web server.
 */
import { createLicenseForEmail } from "../lib/ase-license";
import { sendLicenseKeyEmail } from "../lib/ase-license-email";
import { prisma } from "@digitify/db";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";

function getAdminCreds() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD required");
  }
  return { email, password };
}

async function loginAsOwner() {
  const { email, password } = getAdminCreds();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  const cookieJar = new Map<string, string>();

  function storeCookies(res: Response) {
    const raw = res.headers.getSetCookie?.() || [];
    for (const line of raw) {
      const part = line.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) cookieJar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }

  storeCookies(csrfRes);
  const cookieHeader = () =>
    [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email,
    password,
    json: "true",
    callbackUrl: `${BASE}/settings/ase-licenses`,
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(),
    },
    body,
    redirect: "manual",
  });
  storeCookies(loginRes);

  if (!cookieJar.has("next-auth.session-token") && !cookieJar.has("__Secure-next-auth.session-token")) {
    throw new Error(`Login failed (status ${loginRes.status})`);
  }

  return cookieHeader();
}

async function trpcMutation(cookie: string, path: string, input: unknown) {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ json: input }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  const cookie = await loginAsOwner();

  // Non-owner gate: list without cookie must 401
  const unauth = await fetch(`${BASE}/api/trpc/aseLicense.list`, {
    method: "GET",
  });
  if (unauth.status !== 401 && unauth.status !== 200) {
    // tRPC may return 200 with error envelope
  }
  const unauthJson = await unauth.json().catch(() => null);
  const unauthError =
    unauthJson?.error?.json?.data?.code ||
    unauthJson?.[0]?.error?.json?.data?.code ||
    unauthJson?.error?.data?.code;

  const created = await trpcMutation(cookie, "aseLicense.createForEmail", {
    email: "auth-smoke@example.com",
    name: "Auth Smoke",
    siteUrl: "https://auth-smoke.example.com",
  });

  const result =
    created.json?.result?.data?.json ||
    created.json?.result?.data ||
    created.json;

  if (!result?.key) {
    throw new Error(`createForEmail failed: ${JSON.stringify(created.json).slice(0, 500)}`);
  }

  const act = await fetch(`${BASE}/api/public/ase-license/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: result.key, siteUrl: "https://auth-smoke.example.com" }),
  });
  const actJson = await act.json();

  const val = await fetch(`${BASE}/api/public/ase-license/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: result.key, siteUrl: "https://auth-smoke.example.com" }),
  });
  const valJson = await val.json();

  // Direct mail helper with fallback
  const mail = await sendLicenseKeyEmail(prisma, {
    toEmail: "fallback-mail@example.com",
    name: "Fallback",
    key: result.key,
    userId: "smoke",
  });

  // Extra: createLicenseForEmail invalid
  const bad = await createLicenseForEmail({ email: "nope" });

  console.log(
    JSON.stringify(
      {
        loginOk: true,
        unauthCode: unauthError || unauth.status,
        createForEmail: {
          ok: true,
          emailSent: result.emailSent,
          emailError: result.emailError,
          keyPrefix: String(result.key).slice(0, 12),
        },
        activate: { status: act.status, ok: actJson.ok },
        validate: { status: val.status, ok: valJson.ok },
        mailFallback: { success: mail.success, messageId: mail.messageId || null },
        invalidCreate: bad.ok === false ? bad.error : "unexpected_ok",
      },
      null,
      2,
    ),
  );

  if (!actJson.ok || !valJson.ok) throw new Error("activate/validate failed");
  if (!mail.success) throw new Error("mail fallback failed");
  if (bad.ok) throw new Error("invalid email should fail");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
