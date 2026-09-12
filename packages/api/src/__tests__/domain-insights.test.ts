import { describe, expect, it } from "vitest";
import { applyDomainTrackerHit, createDomainTrackerStore } from "../lib/domain-insights";

const domain = { id: "domain-1", domainName: "digitify.be" };

function hit(overrides: Partial<Parameters<typeof applyDomainTrackerHit>[1]> = {}) {
  return {
    visitorId: "visitor-1",
    sessionId: "session-1",
    pageUrl: "/",
    title: "Home",
    referrerSource: "Direct",
    language: "nl-BE",
    timezone: "Europe/Brussels",
    deviceType: "desktop",
    browser: "Chrome",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    occurredAt: "2026-09-11T10:00:00.000Z",
    ...overrides,
  };
}

describe("applyDomainTrackerHit", () => {
  it("uses the session identity consistently for repeated events", () => {
    const first = applyDomainTrackerHit(null, hit(), domain);
    const second = applyDomainTrackerHit(first, hit({ occurredAt: "2026-09-11T10:01:00.000Z" }), domain);

    expect(second.summary).toMatchObject({ pageviews: 2, uniqueVisitors: 1 });
    expect(second.visitors).toEqual([expect.objectContaining({ id: "session-1", count: 2 })]);
  });

  it("keeps cumulative totals when detailed visitor snapshots reach their storage limit", () => {
    let tracker = createDomainTrackerStore(domain.id, domain.domainName);
    for (let index = 0; index < 51; index += 1) {
      tracker = applyDomainTrackerHit(
        tracker,
        hit({ visitorId: `visitor-${index}`, sessionId: `session-${index}`, occurredAt: `2026-09-11T10:${String(index).padStart(2, "0")}:00.000Z` }),
        domain,
      );
    }

    expect(tracker.summary).toMatchObject({ pageviews: 51, uniqueVisitors: 51 });
    expect(tracker.visitors).toHaveLength(50);
  });

  it("keeps campaign, page and referrer counters bounded", () => {
    let tracker = createDomainTrackerStore(domain.id, domain.domainName);
    for (let index = 0; index < 25; index += 1) {
      tracker = applyDomainTrackerHit(
        tracker,
        hit({
          visitorId: `visitor-${index}`,
          pageUrl: `/page-${index}`,
          referrerSource: `source-${index}`,
          utmSource: `source-${index}`,
          utmMedium: "email",
          utmCampaign: `campaign-${index}`,
        }),
        domain,
      );
    }

    expect(tracker.pages).toHaveLength(20);
    expect(tracker.referrers).toHaveLength(10);
    expect(tracker.campaigns).toHaveLength(10);
  });
});
