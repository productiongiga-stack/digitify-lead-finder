import { describe, expect, it } from "vitest";
import { EmailTemplateType } from "@digitify/db";
import {
  buildOutboundTemplateWhere,
  emailTemplateDataFromInput,
  normalizeEmailTemplateInput,
} from "../lib/email-templates";

describe("email-templates", () => {
  it("builds campaign filter with global and unscoped templates", () => {
    const where = buildOutboundTemplateWhere("workspace-1", { campaignId: "camp-1" });
    expect(where).toEqual({
      createdById: "workspace-1",
      OR: [{ isGlobal: true }, { campaignId: null }, { campaignId: "camp-1" }],
    });
  });

  it("returns workspace-only where when no campaign is selected", () => {
    expect(buildOutboundTemplateWhere("workspace-1")).toEqual({ createdById: "workspace-1" });
    expect(buildOutboundTemplateWhere("workspace-1", { type: EmailTemplateType.FOLLOW_UP })).toEqual({
      createdById: "workspace-1",
      type: EmailTemplateType.FOLLOW_UP,
    });
  });

  it("filters by template type in database query", () => {
    expect(buildOutboundTemplateWhere("workspace-1", { type: EmailTemplateType.OUTREACH })).toEqual({
      createdById: "workspace-1",
      type: EmailTemplateType.OUTREACH,
    });
  });

  it("stores clean body and columns instead of inline tags", () => {
    const data = emailTemplateDataFromInput({
      body: "Hallo\n\n[[LAYOUT=proposal]]\n[[TYPE=PROPOSAL]]\n[[CTA_TEXT=Klik]]\n[[CTA_URL=https://example.com]]",
      description: "Test",
    });
    expect(data.body).toBe("Hallo");
    expect(data.layout).toBe("proposal");
    expect(data.type).toBe("PROPOSAL");
    expect(data.ctaText).toBe("Klik");
    expect(data.ctaUrl).toBe("https://example.com");
    expect(data.body).not.toContain("[[LAYOUT=");
  });

  it("rejects unsafe CTA urls", () => {
    const normalized = normalizeEmailTemplateInput({
      body: "Hi",
      ctaText: "Click",
      ctaUrl: "javascript:alert(1)",
    });
    expect(normalized.ctaUrl).toBe("");
    expect(normalized.ctaText).toBe("");
  });
});
