import { describe, expect, it } from "vitest";
import { formatTrpcErrorMessage } from "./format-error";

describe("formatTrpcErrorMessage", () => {
  it("parses legacy JSON Zod issue arrays", () => {
    const raw =
      '[{"code":"custom","message":"Wachtwoord moet minimaal 10 tekens lang zijn.","path":["newPassword"]}]';
    expect(formatTrpcErrorMessage(raw)).toBe("Wachtwoord moet minimaal 10 tekens lang zijn.");
  });

  it("keeps normal messages unchanged", () => {
    expect(formatTrpcErrorMessage("Huidig wachtwoord klopt niet.")).toBe(
      "Huidig wachtwoord klopt niet.",
    );
  });

  it("formats multiple JSON issues as bullets", () => {
    const raw =
      '[{"message":"Eerste fout."},{"message":"Tweede fout."}]';
    expect(formatTrpcErrorMessage(raw)).toBe("• Eerste fout.\n• Tweede fout.");
  });
});
