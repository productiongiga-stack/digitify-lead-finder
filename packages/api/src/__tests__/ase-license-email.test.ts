import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/email-sender", () => ({
  sendBrandedEmail: vi.fn(),
}));

vi.mock("@digitify/email", async () => {
  const actual = await vi.importActual<typeof import("@digitify/email")>("@digitify/email");
  return {
    ...actual,
    createEmailProvider: vi.fn(() => ({
      name: "console",
      send: vi.fn(async () => ({ success: true, messageId: "console-fallback" })),
    })),
  };
});

import { sendBrandedEmail } from "../lib/email-sender";
import { createEmailProvider } from "@digitify/email";
import { sendLicenseKeyEmail, buildLicenseEmailBody } from "../lib/ase-license-email";

describe("buildLicenseEmailBody", () => {
  it("includes key and activation instructions", () => {
    const body = buildLicenseEmailBody({ name: "Marie", key: "ASE-1111-2222-3333-4444" });
    expect(body).toContain("Hallo Marie");
    expect(body).toContain("ASE-1111-2222-3333-4444");
    expect(body).toContain("Digitify AI Webbuilder");
    expect(body).toContain("/ase-license");
  });
});

describe("sendLicenseKeyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.EMAIL_PROVIDER = "console";
    vi.mocked(sendBrandedEmail).mockResolvedValue({ success: true, messageId: "m1" });
  });

  it("uses branded email when it succeeds", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.NODE_ENV = "production";
    const db = {} as never;
    const result = await sendLicenseKeyEmail(db, {
      toEmail: "klant@voorbeeld.be",
      name: "Marie",
      key: "ASE-1111-2222-3333-4444",
      userId: "owner_1",
    });

    expect(result.success).toBe(true);
    expect(sendBrandedEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        toEmail: "klant@voorbeeld.be",
        subject: "Je Digitify AI Builder license key",
        userId: "owner_1",
        body: expect.stringContaining("ASE-1111-2222-3333-4444"),
      }),
    );
    expect(createEmailProvider).not.toHaveBeenCalled();
  });

  it("skips branded SMTP when EMAIL_PROVIDER=console", async () => {
    process.env.EMAIL_PROVIDER = "console";
    const result = await sendLicenseKeyEmail({} as never, {
      toEmail: "x@y.be",
      key: "ASE-AAAA-BBBB-CCCC-DDDD",
      userId: "owner_1",
    });

    expect(result.success).toBe(true);
    expect(sendBrandedEmail).not.toHaveBeenCalled();
    expect(createEmailProvider).toHaveBeenCalledWith({ provider: "console" });
  });

  it("falls back to console when branded send fails in non-production", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.NODE_ENV = "development";
    vi.mocked(sendBrandedEmail).mockResolvedValue({
      success: false,
      error: "E-mail afzender ontbreekt. Configureer eerst SMTP en e-mailinstellingen.",
    });

    const result = await sendLicenseKeyEmail({} as never, {
      toEmail: "x@y.be",
      key: "ASE-AAAA-BBBB-CCCC-DDDD",
      userId: "owner_1",
    });

    expect(result.success).toBe(true);
    expect(createEmailProvider).toHaveBeenCalledWith({ provider: "console" });
  });

  it("does not fall back in production without console provider", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "smtp";
    vi.mocked(sendBrandedEmail).mockResolvedValue({
      success: false,
      error: "SMTP down",
    });

    const result = await sendLicenseKeyEmail({} as never, {
      toEmail: "x@y.be",
      key: "ASE-AAAA-BBBB-CCCC-DDDD",
      userId: "owner_1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("SMTP down");
    expect(createEmailProvider).not.toHaveBeenCalled();
  });
});
