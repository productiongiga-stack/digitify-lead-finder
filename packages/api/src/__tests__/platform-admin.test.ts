import { afterEach, describe, expect, it } from "vitest";
import { isPlatformOwner } from "../lib/platform-admin";

const original = process.env.PLATFORM_OWNER_EMAILS;

afterEach(() => {
  if (original === undefined) delete process.env.PLATFORM_OWNER_EMAILS;
  else process.env.PLATFORM_OWNER_EMAILS = original;
});

describe("platform owner access", () => {
  it("requires an explicit email allowlist and OWNER role", () => {
    process.env.PLATFORM_OWNER_EMAILS = "test@digitify.be";
    expect(isPlatformOwner({ id: "1", email: "TEST@DIGITIFY.BE", role: "OWNER" })).toBe(true);
    expect(isPlatformOwner({ id: "2", email: "test@digitify.be", role: "ADMIN" })).toBe(false);
  });

  it("does not grant global access to an ordinary workspace owner", () => {
    process.env.PLATFORM_OWNER_EMAILS = "contact@digitify.be";
    expect(isPlatformOwner({ id: "1", email: "other@digitify.be", role: "OWNER" })).toBe(false);
  });
});
