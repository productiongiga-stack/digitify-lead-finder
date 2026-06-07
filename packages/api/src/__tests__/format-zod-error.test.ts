import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatZodErrorMessage } from "../lib/format-zod-error";
import { passwordPolicySchema } from "../lib/password-policy";

describe("formatZodErrorMessage", () => {
  it("returns a single validation message", () => {
    const result = passwordPolicySchema.safeParse("short");
    if (result.success) throw new Error("expected failure");
    expect(formatZodErrorMessage(result.error)).toBe(
      "Wachtwoord moet minimaal 10 tekens lang zijn.",
    );
  });

  it("joins multiple issues with bullets", () => {
    const schema = z.object({
      email: z.string().email("Ongeldig e-mailadres."),
      name: z.string().min(2, "Naam is te kort."),
    });
    const result = schema.safeParse({ email: "x", name: "" });
    if (result.success) throw new Error("expected failure");
    expect(formatZodErrorMessage(result.error)).toBe(
      "• Ongeldig e-mailadres.\n• Naam is te kort.",
    );
  });

  it("falls back when no issue messages exist", () => {
    const error = new z.ZodError([]);
    expect(formatZodErrorMessage(error)).toBe("Controleer je invoer en probeer opnieuw.");
  });
});
