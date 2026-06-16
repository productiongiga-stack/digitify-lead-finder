import { describe, it, expect } from "vitest";
import { parseEmailDraftResponse, parseConfidence, parseLeadAnalysisJson } from "../client";

describe("parseEmailDraftResponse", () => {
  it("parses structured email draft", () => {
    const response = `ONDERWERP: Hallo daar
---
Beste ondernemer,

Ik neem contact op.
---
REDENERING: Korte intro`;
    const draft = parseEmailDraftResponse(response);
    expect(draft.subject).toBe("Hallo daar");
    expect(draft.body).toContain("Beste ondernemer");
  });

  it("does not leak raw response when parsing fails", () => {
    const response = "Dit is alleen vrije tekst zonder structuur.";
    const draft = parseEmailDraftResponse(response);
    expect(draft.body).toBe("");
    expect(draft.reasoning).toContain("niet parseren");
  });
});

describe("parseLeadAnalysisJson", () => {
  it("parses valid JSON payload", () => {
    const json = JSON.stringify({
      summary: "Sterke kans op conversie",
      opportunities: ["Website optimalisatie"],
      risks: ["Geen SSL"],
      suggestedApproach: "Bel en bied audit aan",
      confidence: 78,
    });
    const parsed = parseLeadAnalysisJson(json);
    expect(parsed?.summary).toBe("Sterke kans op conversie");
    expect(parsed?.confidence).toBe(78);
  });

  it("returns null for invalid JSON", () => {
    expect(parseLeadAnalysisJson("geen json hier")).toBeNull();
  });
});

describe("parseConfidence", () => {
  it("extracts confidence from response", () => {
    expect(parseConfidence("Analyse\nCONFIDENCE: 82")).toBe(82);
  });

  it("defaults to 50 when missing", () => {
    expect(parseConfidence("Geen confidence hier")).toBe(50);
  });
});
