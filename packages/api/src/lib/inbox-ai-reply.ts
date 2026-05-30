import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { normalizeAiPlaceholderSyntax } from "./email-utils";
import { emailBodyForAi } from "./inbox-mime-body";
import { loadAiProviderConfig } from "./ai-provider-config";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";

export type InboxAiPurpose = "reply" | "follow_up" | "compose";

export type GenerateInboxAiInput = {
  purpose: InboxAiPurpose;
  style: string;
  subject?: string;
  draftBody?: string;
  incomingSubject?: string;
  incomingBody?: string;
  incomingHtml?: string;
  recipientEmail?: string;
  recipientName?: string;
};

async function getOpenClawClient(db: PrismaClient, workspaceId: string) {
  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) return null;
  return new OpenClawClient({ apiKey, model, provider });
}

async function loadBusinessContext(db: PrismaClient, workspaceId: string) {
  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [
    "branding.company_name",
    "company.name",
    "chatbot.training_notes",
    "openclaw.business_context",
    "chatbot.knowledge_pages",
    "chatbot.response_style",
    "company.website",
    "company.email",
    "company.phone",
  ]);
  const settings = settingsRowsToMap(rows);
  const companyName =
    getSettingString(settings, "branding.company_name") ||
    getSettingString(settings, "company.name", "Digitify");
  const services = getSettingString(settings, "openclaw.business_context", "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);
  const knowledgePages = getSettingString(settings, "chatbot.knowledge_pages", "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    companyName,
    businessContext: {
      companyDescription: getSettingString(settings, "chatbot.training_notes", "").slice(0, 2000),
      services,
      website: getSettingString(settings, "company.website", ""),
      contactEmail: getSettingString(settings, "company.email", ""),
      contactPhone: getSettingString(settings, "company.phone", ""),
      responseStyle: getSettingString(settings, "chatbot.response_style", "professioneel"),
      knowledgePages,
    },
  };
}

export function buildInboxAiPrompt(input: GenerateInboxAiInput & { incomingBody: string }) {
  const incoming = input.incomingBody.trim();
  const draft = (input.draftBody || "").trim();
  const replySubject = input.subject?.trim() || input.incomingSubject?.trim() || "Bericht";

  if (input.purpose === "reply") {
    return `Je bent een professionele e-mail assistent. Schrijf een antwoord in het Nederlands (België) in een "${input.style}" stijl.

AFZENDER VAN HET INKOMENDE BERICHT (ontvanger van jouw antwoord):
${input.recipientName || "Onbekend"}${input.recipientEmail ? ` <${input.recipientEmail}>` : ""}

ONDERWERP INKOMEND BERICHT:
${input.incomingSubject || "(geen onderwerp)"}

VOLLEDIGE INHOUD VAN HET INKOMENDE BERICHT — lees dit zorgvuldig en reageer inhoudelijk:
---
${incoming}
---

${draft ? `HUIDIG CONCEPT (pas aan / verbeter op basis van het inkomende bericht):\n${draft}\n` : ""}

INSTRUCTIES:
- Beantwoord concreet wat de afzender vraagt, bevestigt of voorstelt
- Gebruik details uit hun bericht (data, namen, vragen) — geen generiek antwoord
- Geen markdown; alleen platte tekst klaar om te verzenden
- Begin met een passende aanhef (bv. Beste [naam],)
- Sluit af met een korte professionele groet; gebruik {{senderName}} voor je naam indien nodig
- Placeholders alleen: {{senderName}}, {{senderTitle}}, {{senderCompany}}, {{senderEmail}}, {{senderPhone}}
- Onderwerp: Re: op het inkomende onderwerp (vermijd dubbele "Re: Re:")

Geef je antwoord exact in dit formaat:
ONDERWERP: [onderwerpregel]
---
[alleen de e-mail body, geen uitleg]
---`;
  }

  const purposeLabel =
    input.purpose === "follow_up" ? "opvolgmail na een eerder contact" : "nieuw outbound bericht";

  return `Schrijf of herschrijf een professionele Nederlandse e-mail (${purposeLabel}) in een "${input.style}" stijl.

${input.recipientName || input.recipientEmail ? `Ontvanger: ${input.recipientName || input.recipientEmail}${input.recipientEmail ? ` <${input.recipientEmail}>` : ""}` : ""}
${input.incomingSubject ? `Eerder onderwerp / context: ${input.incomingSubject}` : ""}
${incoming ? `Eerdere conversatie / context:\n---\n${incoming}\n---` : ""}
${replySubject ? `Huidig onderwerp: ${replySubject}` : ""}
${draft ? `Huidige concepttekst:\n${draft}` : "Schrijf een volledig nieuw bericht."}

BELANGRIJK:
- Nederlands (België), klaar om te verzenden
- Geen markdown
- Placeholders: {{senderName}}, {{senderTitle}}, {{senderCompany}}, {{senderEmail}}, {{senderPhone}}

ONDERWERP: [onderwerpregel]
---
[e-mail body]
---`;
}

export function parseInboxAiResponse(
  response: string,
  fallbackSubject: string,
): { subject: string; body: string } {
  const subjectMatch = response.match(/ONDERWERP:\s*(.+)/);
  const bodyMatch = response.match(/---\n([\s\S]*?)\n---/);
  return {
    subject: normalizeAiPlaceholderSyntax(subjectMatch?.[1]?.trim() || fallbackSubject),
    body: normalizeAiPlaceholderSyntax(bodyMatch?.[1]?.trim() || response.trim()),
  };
}

export async function generateInboxAiMessage(
  db: PrismaClient,
  workspaceId: string,
  input: GenerateInboxAiInput,
) {
  const client = await getOpenClawClient(db, workspaceId);
  if (!client) {
    return {
      rewritten: null,
      error: "API key niet geconfigureerd. Ga naar Instellingen → Integraties.",
    } as const;
  }

  const incomingBody = emailBodyForAi({
    text: input.incomingBody,
    html: input.incomingHtml,
  });

  if (input.purpose === "reply" && !incomingBody.trim()) {
    return {
      rewritten: null,
      error: "Kon de inhoud van deze e-mail niet lezen. Open het bericht opnieuw of wacht tot het volledig geladen is.",
    } as const;
  }

  const businessContextData = await loadBusinessContext(db, workspaceId);
  const prompt = buildInboxAiPrompt({ ...input, incomingBody });
  const response = await client.chat([{ role: "user", content: prompt }], {
    businessContext: businessContextData.businessContext,
    settings: {
      aggressiveness: "balanced",
      tone: "professional",
      language: "nl",
      companyName: businessContextData.companyName,
    },
    leadData: {
      companyName: input.recipientName || input.recipientEmail || "Ontvanger",
      website: null,
      city: null,
      industry: null,
      overallScore: null,
      scorePriority: null,
      gmbRating: null,
      gmbReviewCount: null,
    },
  });

  const fallbackSubject =
    input.subject ||
    (input.incomingSubject?.startsWith("Re:") ? input.incomingSubject : `Re: ${input.incomingSubject || "Bericht"}`);

  return {
    rewritten: parseInboxAiResponse(response, fallbackSubject),
    error: null,
  } as const;
}
