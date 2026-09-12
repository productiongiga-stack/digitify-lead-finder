import { describe, expect, it } from "vitest";
import { SECURITY_AUDIT_PUBLIC_SELECT } from "../routers/security-audit.router";

describe("security audit browser projection", () => {
  it("never exposes audit metadata or workspace internals", () => {
    expect(SECURITY_AUDIT_PUBLIC_SELECT).toEqual({
      id: true,
      action: true,
      resource: true,
      resourceId: true,
      result: true,
      reason: true,
      createdAt: true,
      actorUserId: true,
      targetUserId: true,
    });
    expect("metadata" in SECURITY_AUDIT_PUBLIC_SELECT).toBe(false);
    expect("workspaceId" in SECURITY_AUDIT_PUBLIC_SELECT).toBe(false);
  });
});
