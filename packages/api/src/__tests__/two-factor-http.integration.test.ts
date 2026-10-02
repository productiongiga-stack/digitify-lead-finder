import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@digitify/db";
import { generate } from "otplib";
import { upgradedPassword } from "../lib/two-factor-crypto";
const base = process.env.TWO_FACTOR_TEST_URL || "http://127.0.0.1:3001";
const enabled = process.env.RUN_HTTP_INTEGRATION === "1" && ["localhost", "127.0.0.1", "::1"].includes(new URL(base).hostname);
describe.skipIf(!enabled)("two-factor HTTP end-to-end (disposable local accounts only)", () => {
  const db = new PrismaClient(), ids: string[] = [];
  const password = "Disposable-HTTP-test-only!2026";
  afterAll(async () => { await db.securityAuditEvent.deleteMany({ where: { targetUserId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); });
  function browser() {
    const jar = new Map<string, string>();
    return {
      async call(path: string, body?: unknown, form = false) {
        const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { Cookie: Array.from(jar).map(([k, v]) => k + "=" + v).join("; "), ...(body ? { Origin: base, "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" } : {}) }, body: body ? form ? new URLSearchParams(body as Record<string, string>).toString() : JSON.stringify(body) : undefined, redirect: "manual" });
        for (const cookie of response.headers.getSetCookie()) { const part = cookie.split(";")[0]!, at = part.indexOf("="); jar.set(part.slice(0, at), part.slice(at + 1)); }
        return response;
      },
      async finish(code = "", method = "totp") {
        const csrf = await (await this.call("/api/auth/csrf")).json();
        return this.call("/api/auth/callback/credentials", { csrfToken: csrf.csrfToken, code, method, json: "true", callbackUrl: base + "/dashboard" }, true);
      },
    };
  }
  async function account() { const user = await db.user.create({ data: { email: `2fa-http-${crypto.randomUUID()}@example.test`, name: "Disposable HTTP verification", role: "OWNER", passwordHash: upgradedPassword(password), emailVerified: new Date() } }); ids.push(user.id); return user; }
  it("does not allow credentials callback bypass; completes enrollment, revokes old sessions, verifies authenticator and consumes recovery codes", async () => {
    const user = await account(), client = browser();
    const bypass = browser(), csrf = await (await bypass.call("/api/auth/csrf")).json();
    await bypass.call("/api/auth/callback/credentials", { csrfToken: csrf.csrfToken, email: user.email, password, json: "true" }, true);
    expect((await (await bypass.call("/api/auth/session")).json()).user).toBeUndefined();
    const first = await client.call("/api/auth/login-start", { email: user.email, password });
    expect(first.status).toBe(200); expect(await first.json()).toEqual({ requiresTwoFactor: false });
    expect(first.headers.get("set-cookie")).toMatch(/HttpOnly/i); expect(first.headers.get("set-cookie")).toMatch(/SameSite=Strict/i);
    expect(first.headers.get("cache-control")).toContain("no-store");
    await client.finish(); expect((await (await client.call("/api/auth/session")).json()).user.id).toBe(user.id);
    const setupResponse = await client.call("/api/two-factor/setup", { password }); expect(setupResponse.status).toBe(200);
    const setup = await setupResponse.json();
    const token = await generate({ secret: setup.secret, epoch: Math.floor(Date.now() / 1000), algorithm: "sha1", digits: 6, period: 30 });
    const checkedResponse = await client.call("/api/two-factor/verify", { code: token }); expect(checkedResponse.status).toBe(200);
    const checked = await checkedResponse.json(); expect(checked.codes).toHaveLength(10);
    expect((await client.call("/api/two-factor/confirm", { proof: checked.proof, saved: false })).status).toBe(400);
    expect((await client.call("/api/two-factor/confirm", { proof: checked.proof, saved: true })).status).toBe(200);
    expect((await (await client.call("/api/auth/session")).json()).user).toBeUndefined();
    const login = browser();
    expect(await (await login.call("/api/auth/login-start", { email: user.email, password })).json()).toEqual({ requiresTwoFactor: true });
    await login.finish(); expect((await (await login.call("/api/auth/session")).json()).user).toBeUndefined();
    // An adjacent future step is allowed; the setup's own code cannot be replayed.
    const fresh = await generate({ secret: setup.secret, epoch: Math.floor(Date.now() / 30000) * 30 + 30, algorithm: "sha1", digits: 6, period: 30 });
    await login.finish(fresh); expect((await (await login.call("/api/auth/session")).json()).user.id).toBe(user.id);
    const rescue = browser(); await rescue.call("/api/auth/login-start", { email: user.email, password });
    await rescue.finish(checked.codes[0], "recovery"); expect((await (await rescue.call("/api/auth/session")).json()).user.id).toBe(user.id);
    const replay = browser(); await replay.call("/api/auth/login-start", { email: user.email, password }); await replay.finish(checked.codes[0], "recovery");
    expect((await (await replay.call("/api/auth/session")).json()).user).toBeUndefined();
    expect((await (await rescue.call("/api/two-factor/status")).json()).recoveryCodesRemaining).toBe(9);
  }, 90000);
  it("rejects cross-origin writes and unauthenticated access", async () => {
    const response = await fetch(base + "/api/auth/login-start", { method: "POST", headers: { Origin: "https://attacker.example", "Content-Type": "application/json" }, body: JSON.stringify({ email: "nobody@example.test", password }) });
    expect(response.status).toBe(403);
    expect((await fetch(base + "/api/two-factor/status")).status).toBe(401);
  });
});
