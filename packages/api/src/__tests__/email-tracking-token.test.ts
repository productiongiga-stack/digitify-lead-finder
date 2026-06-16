import { describe, it, expect } from "vitest";
import { createEmailTrackingToken, verifyEmailTrackingToken } from "../lib/email-tracking-token";

describe("email tracking tokens", () => {
  it("creates and verifies a valid token", () => {
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret-min-32-chars!!";
    const draftId = "draft_abc123";
    const token = createEmailTrackingToken(draftId);
    expect(verifyEmailTrackingToken(draftId, token)).toBe(true);
  });

  it("rejects tampered tokens", () => {
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret-min-32-chars!!";
    const token = createEmailTrackingToken("draft_abc123");
    expect(verifyEmailTrackingToken("draft_other", token)).toBe(false);
  });
});
