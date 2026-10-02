import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rate: vi.fn(), setup: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@digitify/db", () => ({ prisma: {} }));
vi.mock("@digitify/api/src/lib/two-factor", async (original) => ({ ...await original<Record<string, unknown>>(), authRateLimit: mocks.rate, beginFactorSetup: mocks.setup }));
vi.mock("@digitify/api/src/lib/two-factor-notifications", () => ({ notifyFactorChange: mocks.notify }));
import { POST } from "@/app/api/two-factor/[action]/route";
import { requireAuthOrigin, LOGIN_COOKIE, factorCookieOptions } from "../two-factor-http";
beforeEach(() => { vi.clearAllMocks(); mocks.rate.mockResolvedValue(undefined); });
describe("personal factor HTTP authorization", () => {
  it.each([null, { id: "target", actorUserId: "owner", isViewingAs: true }])("rejects unauthenticated/impersonating requests before accessing factor data", async (user) => {
    mocks.user.mockResolvedValue(user);
    const request = new Request("http://localhost:3000/api/two-factor/setup", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ password: "test-only" }) });
    const response = await POST(request, { params: Promise.resolve({ action: "setup" }) });
    expect(response.status).toBe(403); expect(mocks.setup).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
  });
  it("does not accept a supplied user id as authority", async () => {
    mocks.user.mockResolvedValue({ id: "own-account" });
    const request = new Request("http://localhost:3000/api/two-factor/setup", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ password: "test-only", userId: "victim" }) });
    const response = await POST(request, { params: Promise.resolve({ action: "setup" }) });
    expect(response.status).toBe(400); expect(mocks.setup).not.toHaveBeenCalled();
  });
  it("uses HttpOnly strict cookies and rejects hostile origins", () => {
    expect(LOGIN_COOKIE).toContain("digitify-login-challenge");
    expect(factorCookieOptions).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
    expect(() => requireAuthOrigin(new Request("http://localhost:3000/api/two-factor/setup", { headers: { Origin: "https://evil.example" } }))).toThrow();
    expect(() => requireAuthOrigin(new Request("http://localhost:3000/api/two-factor/setup"))).toThrow();
  });
});
