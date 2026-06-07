import { describe, expect, it } from "vitest";
import {
  brandingToWizardDefaults,
  buildEmailShellPreviewProps,
  getEmailShellBrandingChecklist,
  getEmailShellChecklistSummary,
} from "../email-shell-branding";

describe("email-shell-branding", () => {
  it("flags missing required identity fields", () => {
    const items = getEmailShellBrandingChecklist({
      companyName: "Digitify",
      primaryColor: "#f9ae5a",
      fromName: "",
      fromEmail: "",
    });
    const summary = getEmailShellChecklistSummary(items);
    expect(summary.isReady).toBe(false);
    expect(summary.missingRequired.map((item) => item.id)).toEqual(["fromName", "fromEmail"]);
  });

  it("marks checklist ready when required fields are filled", () => {
    const items = getEmailShellBrandingChecklist({
      companyName: "Digitify",
      primaryColor: "#112233",
      fromName: "Jan",
      fromEmail: "jan@digitify.be",
    });
    expect(getEmailShellChecklistSummary(items).isReady).toBe(true);
  });

  it("builds preview props from branding context", () => {
    const props = buildEmailShellPreviewProps({
      companyName: "Digitify",
      primaryColor: "#112233",
      fromName: "Jan",
      headerSlogan: "Groei helder",
      signature: "Groeten",
      footer: "Footer",
    });
    expect(props.companyName).toBe("Digitify");
    expect(props.primaryColor).toBe("#112233");
    expect(props.fromName).toBe("Jan");
    expect(props.headerSlogan).toBe("Groei helder");
    expect(props.signature).toBe("Groeten");
    expect(props.footer).toBe("Footer");
  });

  it("derives wizard defaults from available branding", () => {
    expect(
      brandingToWizardDefaults({
        companyName: "Digitify",
        primaryColor: "#f9ae5a",
        logoUrl: "https://example.com/logo.png",
        headerSlogan: "Slogan",
      }),
    ).toEqual({
      showLogoArea: true,
      showSlogan: true,
    });

    expect(
      brandingToWizardDefaults({
        companyName: "Digitify",
        primaryColor: "#f9ae5a",
      }),
    ).toEqual({
      showLogoArea: false,
      showSlogan: false,
    });
  });
});
