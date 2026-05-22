import { describe, expect, it } from "vitest";
import { EmailTemplateType } from "@digitify/db";
import { buildOutboundTemplateWhere } from "../lib/email-templates";

/**
 * Documents listParsedEmailTemplates campaign scope (forOutbound OR campaignId).
 * Full DB coverage lives in workspace-rls.integration.test.ts and Playwright e2e.
 */
describe("template list campaign scope", () => {
  it("matches outbound filter when Studio passes campaignId only", () => {
    const studioWhere = buildOutboundTemplateWhere("ws-1", { campaignId: "camp-a" });
    const outboundWhere = buildOutboundTemplateWhere("ws-1", {
      campaignId: "camp-a",
      type: EmailTemplateType.OUTREACH,
    });

    expect(studioWhere).toEqual({
      createdById: "ws-1",
      OR: [{ isGlobal: true }, { campaignId: null }, { campaignId: "camp-a" }],
    });
    expect(outboundWhere.type).toBe(EmailTemplateType.OUTREACH);
    expect(outboundWhere.OR).toEqual(studioWhere.OR);
  });
});
