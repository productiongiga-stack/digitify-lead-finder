import { describe, it, expect } from "vitest";
import { replacePlaceholders, hasUnresolvedPlaceholders, buildLeadContext } from "../placeholders";

describe("replacePlaceholders", () => {
  it("replaces known placeholders", () => {
    const result = replacePlaceholders("Hallo {{companyName}}", { companyName: "Bakkerij Peeters" });
    expect(result).toBe("Hallo Bakkerij Peeters");
  });

  it("leaves unknown placeholders as-is by default", () => {
    const result = replacePlaceholders("Hallo {{unknownKey}}", {});
    expect(result).toBe("Hallo {{unknownKey}}");
  });

  it("removes unknown placeholders when removeMissing=true", () => {
    const result = replacePlaceholders("Hallo {{unknownKey}} wereld", {}, { removeMissing: true });
    expect(result).toBe("Hallo  wereld");
  });

  it("uses fallback for missing placeholders", () => {
    const result = replacePlaceholders("Hallo {{name}}", {}, { fallback: "[onbekend]" });
    expect(result).toBe("Hallo [onbekend]");
  });

  it("converts numeric values to strings", () => {
    const result = replacePlaceholders("Score: {{leadScore}}", { leadScore: 78 });
    expect(result).toBe("Score: 78");
  });

  it("skips empty string values and uses fallback", () => {
    const result = replacePlaceholders("{{companyName}}", { companyName: "" }, { fallback: "bedrijf" });
    expect(result).toBe("bedrijf");
  });

  it("auto-injects todayDate", () => {
    const result = replacePlaceholders("{{todayDate}}", {});
    // Should be a non-empty date string like "24 april 2026"
    expect(result).toMatch(/\d+ \w+ \d{4}/);
  });

  it("replaces multiple placeholders in one pass", () => {
    const result = replacePlaceholders("{{senderName}} van {{senderCompany}}", {
      senderName: "Klim",
      senderCompany: "Digitify",
    });
    expect(result).toBe("Klim van Digitify");
  });
});

describe("hasUnresolvedPlaceholders", () => {
  it("returns empty array when no placeholders remain", () => {
    expect(hasUnresolvedPlaceholders("Hallo wereld")).toEqual([]);
  });

  it("returns list of unresolved placeholders", () => {
    const result = hasUnresolvedPlaceholders("{{companyName}} en {{contactName}}");
    expect(result).toContain("{{companyName}}");
    expect(result).toContain("{{contactName}}");
  });

  it("deduplicates repeated placeholders", () => {
    const result = hasUnresolvedPlaceholders("{{name}} {{name}}");
    expect(result).toHaveLength(1);
  });
});

describe("buildLeadContext", () => {
  it("builds context from lead data", () => {
    const ctx = buildLeadContext({
      companyName: "Test BV",
      email: "info@test.be",
      city: "Gent",
      overallScore: 82,
      scorePriority: "Hot",
    });
    expect(ctx.companyName).toBe("Test BV");
    expect(ctx.email).toBe("info@test.be");
    expect(ctx.city).toBe("Gent");
    expect(ctx.leadScore).toBe(82);
    expect(ctx.scorePriority).toBe("Hot");
  });

  it("picks primary contact as contactName", () => {
    const ctx = buildLeadContext({
      companyName: "Test BV",
      contacts: [
        { name: "Jan", isPrimary: false },
        { name: "Marie", isPrimary: true },
      ],
    });
    expect(ctx.contactName).toBe("Marie");
  });

  it("falls back to first contact when none is primary", () => {
    const ctx = buildLeadContext({
      companyName: "Test BV",
      contacts: [{ name: "Jan", isPrimary: false }],
    });
    expect(ctx.contactName).toBe("Jan");
  });

  it("merges sender settings", () => {
    const ctx = buildLeadContext(
      { companyName: "Test BV" },
      { senderName: "Klim", senderCompany: "Digitify" }
    );
    expect(ctx.senderName).toBe("Klim");
    expect(ctx.senderCompany).toBe("Digitify");
  });
});
