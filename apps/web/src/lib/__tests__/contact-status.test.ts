import { describe, expect, it } from "vitest";
import {
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STAT_CARD_STATUSES,
  formatWorkqueueSummary,
  getApprovedNotSentBanner,
  getOutboundNextActionHint,
  getOutboundStatusLabel,
  getSendButtonLabel,
} from "../contact-status";

describe("contact-status", () => {
  it("uses Klaar om te verzenden for APPROVED everywhere", () => {
    expect(getOutboundStatusLabel("APPROVED")).toBe("Klaar om te verzenden");
    expect(OUTBOUND_STATUS_LABELS.APPROVED).toBe("Klaar om te verzenden");
    expect(getApprovedNotSentBanner().title).toContain("Klaar om te verzenden");
    expect(getOutboundNextActionHint("APPROVED")).toContain("Klaar om te verzenden");
    expect(getOutboundNextActionHint("APPROVED")).not.toMatch(/Goedgekeurd/i);
  });

  it("stat cards use canonical status labels", () => {
    for (const status of OUTBOUND_STAT_CARD_STATUSES) {
      expect(getOutboundStatusLabel(status)).toBe(OUTBOUND_STATUS_LABELS[status]);
    }
  });

  it("formats workqueue summary with status labels", () => {
    const summary = formatWorkqueueSummary({ pending: 2, approved: 3, failed: 1 });
    expect(summary).toContain("wacht op goedkeuring");
    expect(summary).toContain("klaar om te verzenden");
    expect(summary).toContain("mislukt");
    expect(summary).not.toMatch(/goedgekeurd/i);
  });

  it("send button labels for failed and pending", () => {
    expect(getSendButtonLabel("APPROVED")).toBe("Verzenden");
    expect(getSendButtonLabel("FAILED")).toBe("Opnieuw verzenden");
    expect(getSendButtonLabel("APPROVED", true)).toBe("Verzenden...");
  });
});
