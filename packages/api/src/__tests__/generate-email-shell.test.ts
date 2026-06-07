import { describe, expect, it } from "vitest";
import {
  MASTER_SHELL_REQUIRED_PLACEHOLDERS,
  validateGeneratedMasterShell,
} from "../lib/generate-email-shell";
import { DEFAULT_MASTER_SHELL_HTML } from "@digitify/email";

describe("validateGeneratedMasterShell", () => {
  it("accepts the default studio shell", () => {
    expect(validateGeneratedMasterShell(DEFAULT_MASTER_SHELL_HTML)).toBeNull();
  });

  it("rejects HTML missing required placeholders", () => {
    const html = "<!DOCTYPE html><html><body>{{content}}</body></html>";
    const error = validateGeneratedMasterShell(html);
    expect(error).toBeTruthy();
    expect(error).toContain("{{ctaBlock}}");
  });

  it("rejects script tags and javascript URLs", () => {
    const base = DEFAULT_MASTER_SHELL_HTML.replace(
      "</body>",
      '<a href="javascript:alert(1)">x</a></body>',
    );
    expect(validateGeneratedMasterShell(base)).toContain("javascript");

    const withScript = DEFAULT_MASTER_SHELL_HTML.replace(
      "</body>",
      "<script>alert(1)</script></body>",
    );
    expect(validateGeneratedMasterShell(withScript)).toContain("Script");
  });

  it("lists all required placeholders in the default shell", () => {
    for (const token of MASTER_SHELL_REQUIRED_PLACEHOLDERS) {
      expect(DEFAULT_MASTER_SHELL_HTML).toContain(token);
    }
  });
});
