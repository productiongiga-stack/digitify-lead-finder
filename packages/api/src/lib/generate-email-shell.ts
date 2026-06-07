import { TRPCError } from "@trpc/server";
import { DEFAULT_MASTER_SHELL_HTML } from "@digitify/email";
import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { loadAiProviderConfig } from "./ai-provider-config";
import { loadEmailSettings } from "./email-sender";
import { validateSettingValue } from "./setting-validation";
import { type WorkspaceScope } from "./workspace-settings";

export const MASTER_SHELL_REQUIRED_PLACEHOLDERS = [
  "{{content}}",
  "{{ctaBlock}}",
  "{{signatureBlock}}",
  "{{footerBlock}}",
  "{{companyName}}",
  "{{primaryColor}}",
  "{{headerSlogan}}",
  "{{logoBlock}}",
  "{{unsubscribeBlock}}",
] as const;

export type EmailShellStyle = "brief" | "studio" | "convert" | "custom";

export interface GenerateEmailShellBranding {
  companyName: string;
  primaryColor: string;
  headerSlogan: string;
  logoUrl?: string;
  signature?: string;
  footer?: string;
  website?: string;
}

const STYLE_GUIDANCE: Record<EmailShellStyle, string> = {
  brief:
    "Editoriale brief-stijl: warme achtergrond, persoonlijke uitstraling, elegante typografie, subtiele accentlijn in merkkleur. Denk premium zakelijke brief, niet saai.",
  studio:
    "Studio/corporate: sterke merkheader met {{primaryColor}}, professionele hiërarchie, subtiele schaduw, afgeronde mailkaart, veel witruimte. Premium SaaS-uitstraling.",
  convert:
    "Conversie-gericht: contrastrijk buitenkader, wit kaartvlak, duidelijke CTA-zone, scanbare structuur. Modern marketing-mail met focus op actie.",
  custom:
    "Uniek op maat: verrassend maar professioneel, passend bij het merk. Geen clichés, wel e-mailclient-veilig en elegant.",
};

const SHELL_SYSTEM_PROMPT = `Je bent een senior HTML e-mailontwerper (België/Nederland B2B).
Je schrijft ALLEEN productieklare, e-mailclient-veilige HTML voor Outlook, Gmail en Apple Mail.

Kwaliteitseisen:
- Table-gebaseerde layout met inline CSS op elke <td>/<table> (geen <style>-blokken, geen externe CSS).
- Maximaal 640px breedte voor de mailkaart, gecentreerd.
- Duidelijke visuele hiërarchie: header → body → CTA → footer.
- Subtiele schaduwen en afgeronde hoeken waar passend (inline border-radius).
- Professionele spacing (min. 32px padding in body).
- Geen JavaScript, geen <script>, geen iframe, geen formulieren.

Placeholders (letterlijk in HTML laten, NOOIT vervangen):
{{content}}, {{ctaBlock}}, {{signatureBlock}}, {{footerBlock}}, {{companyName}}, {{primaryColor}}, {{headerSlogan}}, {{logoBlock}}, {{unsubscribeBlock}}

Kleurregels:
- Gebruik {{primaryColor}} voor alle merkaccenten — hardcode de merkkleur NIET als hex.
- Neutrale grijstinten (#f8fafc, #e2e8f0, #64748b) en wit mogen hardcoded.

Bij verfijning van bestaande HTML: behoud alle placeholders en verbeter vooral opmaak, spacing, schaduw en typografie.`;

function extractHtmlFromAiResponse(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  const doctypeIndex = trimmed.search(/<!DOCTYPE\s+html/i);
  if (doctypeIndex >= 0) return trimmed.slice(doctypeIndex).trim();

  const htmlIndex = trimmed.search(/<html[\s>]/i);
  if (htmlIndex >= 0) return trimmed.slice(htmlIndex).trim();

  return trimmed;
}

export function validateGeneratedMasterShell(html: string): string | null {
  const normalized = html.trim();
  if (!normalized) return "AI gaf lege HTML terug.";

  if (!/<!DOCTYPE\s+html/i.test(normalized) && !/<html[\s>]/i.test(normalized)) {
    return "AI gaf geen volledig HTML-document terug.";
  }

  for (const token of MASTER_SHELL_REQUIRED_PLACEHOLDERS) {
    if (!normalized.includes(token)) {
      return `De gegenereerde shell mist de placeholder ${token}.`;
    }
  }

  if (/<script[\s>]/i.test(normalized)) {
    return "Script-tags zijn niet toegestaan in de shell.";
  }

  if (/javascript:/i.test(normalized)) {
    return "Onveilige javascript:-URL's zijn niet toegestaan.";
  }

  return null;
}

function trimReferenceHtml(html: string, maxLength = 14_000) {
  const trimmed = html.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}\n<!-- truncated -->`;
}

function buildUserPrompt(
  branding: GenerateEmailShellBranding,
  style: EmailShellStyle,
  instructions?: string,
  referenceHtml?: string,
): string {
  const isRefine = Boolean(referenceHtml?.trim());
  const lines = [
    isRefine
      ? `Verfijn en verbeter deze bestaande master HTML-shell voor ${branding.companyName}.`
      : `Ontwerp een nieuwe master HTML-shell voor uitgaande e-mails van ${branding.companyName}.`,
    "",
    "Branding:",
    `- Bedrijfsnaam: ${branding.companyName}`,
    `- Merkkleur (placeholder {{primaryColor}}): ${branding.primaryColor}`,
    `- Slogan ({{headerSlogan}}): ${branding.headerSlogan || "—"}`,
    branding.logoUrl
      ? "- Logo: ja — laat {{logoBlock}} staan"
      : "- Geen logo — {{logoBlock}} mag leeg blijven als placeholder",
    branding.website ? `- Website: ${branding.website}` : "",
    branding.signature ? `- Handtekening-context: ${branding.signature.slice(0, 200)}` : "",
    branding.footer ? `- Footer-context: ${branding.footer.slice(0, 200)}` : "",
    "",
    `Stijlrichting: ${STYLE_GUIDANCE[style]}`,
    "",
    "Verplichte placeholders (exact zo laten):",
    MASTER_SHELL_REQUIRED_PLACEHOLDERS.join(", "),
  ];

  if (instructions?.trim()) {
    lines.push("", "Wizard / gebruiker wensen:", instructions.trim());
  }

  if (isRefine && referenceHtml) {
    lines.push(
      "",
      "Uitgangspunt HTML — verbeter opmaak, maak visueel rijker, behoud placeholders:",
      trimReferenceHtml(referenceHtml),
    );
  } else {
    lines.push(
      "",
      "Referentie (kwaliteitsniveau, niet kopiëren):",
      trimReferenceHtml(DEFAULT_MASTER_SHELL_HTML, 4000),
    );
  }

  lines.push("", "Geef alleen het volledige verbeterde HTML-document terug. Geen uitleg.");

  return lines.filter(Boolean).join("\n");
}

export async function generateMasterShellHtml(params: {
  db: PrismaClient;
  scope: WorkspaceScope;
  style: EmailShellStyle;
  instructions?: string;
  referenceHtml?: string;
  brandingOverrides?: Partial<GenerateEmailShellBranding>;
}): Promise<{ html: string; model: string }> {
  const { db, scope, style, instructions, referenceHtml, brandingOverrides } = params;
  const workspaceId = scope.workspaceId;

  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI is niet geconfigureerd. Stel een API-sleutel in onder Instellingen → Integraties.",
    });
  }

  const saved = await loadEmailSettings(db, scope);
  const branding: GenerateEmailShellBranding = {
    companyName: brandingOverrides?.companyName?.trim() || saved.companyName || "Mijn bedrijf",
    primaryColor: brandingOverrides?.primaryColor?.trim() || saved.primaryColor || "#f9ae5a",
    headerSlogan: brandingOverrides?.headerSlogan?.trim() ?? saved.headerSlogan,
    logoUrl: brandingOverrides?.logoUrl?.trim() || saved.logoUrl,
    signature: brandingOverrides?.signature?.trim() ?? saved.signature,
    footer: brandingOverrides?.footer?.trim() ?? saved.footer,
    website: brandingOverrides?.website?.trim() || saved.website,
  };

  const client = new OpenClawClient({ apiKey, model, provider, maxTokens: 6144 });
  const userPrompt = buildUserPrompt(branding, style, instructions, referenceHtml);

  let lastError: string | null = null;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const retryNote =
      attempt > 0 && lastError
        ? `\n\nJe vorige antwoord was ongeldig: ${lastError}. Corrigeer en geef opnieuw alleen geldige HTML met ALLE placeholders.`
        : "";

    const rawResponse = await client.completeRaw(
      SHELL_SYSTEM_PROMPT,
      userPrompt + retryNote,
      6144,
    );

    const html = extractHtmlFromAiResponse(rawResponse);
    const validationError = validateGeneratedMasterShell(html);

    if (!validationError) {
      try {
        validateSettingValue("email.master_shell_html", html);
        return { html, model };
      } catch (err) {
        lastError = err instanceof TRPCError ? err.message : "Validatie mislukt.";
        continue;
      }
    }

    lastError = validationError;
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: lastError || "AI kon geen geldige mail-shell genereren. Probeer opnieuw of pas je wensen aan.",
  });
}
