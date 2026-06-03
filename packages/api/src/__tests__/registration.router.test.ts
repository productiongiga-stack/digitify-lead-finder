import { describe, it, expect, vi, beforeEach } from "vitest";
import { registrationRouter } from "../routers/registration.router";

vi.mock("../lib/email-sender", () => ({
  sendBrandedEmail: vi.fn().mockResolvedValue(undefined),
}));

function publicCtx(db: Record<string, unknown>) {
  return {
    db: {
      user: {
        findUnique: vi.fn(),
      },
      registrationRequest: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      ...db,
    } as any,
    user: null,
    requestId: "req_registration_test",
    clientIp: "127.0.0.1",
  };
}

describe("registrationRouter.requestAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns generic success when email already belongs to a user", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "user_1", email: "exists@example.com" });
    const create = vi.fn();

    const caller = registrationRouter.createCaller(
      publicCtx({
        user: { findUnique },
        registrationRequest: { findFirst: vi.fn(), create },
      }),
    );

    const result = await caller.requestAccess({
      name: "Jan Peeters",
      email: "exists@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({ success: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns generic success when a pending request already exists", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const findFirst = vi.fn().mockResolvedValue({ id: "req_1" });
    const create = vi.fn();

    const caller = registrationRouter.createCaller(
      publicCtx({
        user: { findUnique },
        registrationRequest: { findFirst, create },
      }),
    );

    const result = await caller.requestAccess({
      name: "Jan Peeters",
      email: "pending@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({ success: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a registration request for new emails", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "req_new", name: "Jan", email: "new@example.com" });

    const caller = registrationRouter.createCaller(
      publicCtx({
        user: { findUnique },
        registrationRequest: { findFirst, create },
      }),
    );

    const result = await caller.requestAccess({
      name: "Jan Peeters",
      email: "new@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({ success: true });
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("registrationRouter.verifyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns generic success for invalid verification tokens", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const update = vi.fn();

    const caller = registrationRouter.createCaller(
      publicCtx({
        registrationRequest: { findUnique, update },
      }),
    );

    const result = await caller.verifyEmail({ token: "invalid-token-that-is-long-enough" });

    expect(result).toEqual({ success: true });
    expect(update).not.toHaveBeenCalled();
  });
});
