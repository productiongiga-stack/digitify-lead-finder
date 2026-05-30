import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { OpenClawMessage, OpenClawContext, OpenClawConfig, EmailDraftSuggestion, LeadAnalysis } from "./types";
import { buildSystemPrompt, EMAIL_DRAFT_PROMPT, LEAD_ANALYSIS_PROMPT, NICHE_SUGGESTION_PROMPT } from "./prompts";

export class OpenClawClient {
  private provider: "anthropic" | "openai";
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(config: OpenClawConfig) {
    this.maxTokens = config.maxTokens || 2048;

    const explicit = config.provider;
    const isDeepseek =
      explicit === "deepseek" || config.model?.toLowerCase().startsWith("deepseek");
    const isOpenAI =
      explicit === "openai" ||
      (!isDeepseek && (config.model?.startsWith("gpt-") || config.model?.startsWith("o")));
    this.provider = isOpenAI || isDeepseek ? "openai" : "anthropic";

    if (isDeepseek) {
      this.openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: "https://api.deepseek.com",
      });
      this.model = config.model || "deepseek-chat";
    } else if (this.provider === "openai") {
      this.openai = new OpenAI({ apiKey: config.apiKey });
      this.model = config.model || "gpt-4o";
    } else {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
      this.model = config.model || "claude-sonnet-4-20250514";
    }
  }

  async chat(
    messages: OpenClawMessage[],
    context: OpenClawContext
  ): Promise<string> {
    const systemPrompt = buildSystemPrompt(context);

    if (this.provider === "openai" && this.openai) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
      });
      return response.choices[0]?.message?.content || "";
    }

    // Default: Anthropic
    const response = await this.anthropic!.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : "";
  }

  async draftEmail(context: OpenClawContext): Promise<EmailDraftSuggestion> {
    const response = await this.chat(
      [{ role: "user", content: EMAIL_DRAFT_PROMPT }],
      context
    );

    return parseEmailDraftResponse(response);
  }

  async analyzeLead(context: OpenClawContext): Promise<LeadAnalysis> {
    const response = await this.chat(
      [{ role: "user", content: LEAD_ANALYSIS_PROMPT }],
      context
    );

    return {
      summary: response.substring(0, 300),
      opportunities: extractListItems(response, "kansen"),
      risks: extractListItems(response, "risico"),
      suggestedApproach: extractSection(response, "aanpak") || "Gepersonaliseerde outreach",
      confidence: 75,
    };
  }

  async suggestNiches(context: OpenClawContext): Promise<string> {
    return this.chat(
      [{ role: "user", content: NICHE_SUGGESTION_PROMPT }],
      context
    );
  }

  async suggestFollowUp(context: OpenClawContext, previousEmail: string): Promise<EmailDraftSuggestion> {
    const prompt = `De vorige e-mail naar deze lead was:

${previousEmail}

Er is geen reactie gekomen. Schrijf een follow-up e-mail die:
1. Kort refereert aan de vorige mail
2. Een nieuwe invalshoek biedt
3. Niet pushy is
4. Kort is (max 100 woorden)

Geef je antwoord in dit formaat:
ONDERWERP: [onderwerpregel]
---
[e-mail body]
---
REDENERING: [korte uitleg]`;

    const response = await this.chat([{ role: "user", content: prompt }], context);

    return parseEmailDraftResponse(response, "Even opvolgen", "Follow-up na geen reactie");
  }
}

function parseEmailDraftResponse(
  response: string,
  defaultSubject = "Vraag over uw online aanwezigheid",
  defaultReasoning = "Standaard outreach"
): EmailDraftSuggestion {
  const subjectMatch = response.match(/ONDERWERP:\s*(.+)/);
  // Match body between --- delimiters (tolerates \r\n and trailing spaces)
  const bodyMatch = response.match(/---[ \t]*\r?\n([\s\S]*?)\r?\n---/);
  // Reasoning: everything after REDENERING: up to end of string, strip trailing whitespace
  const reasoningMatch = response.match(/REDENERING:\s*([\s\S]*?)\s*$/);

  const subject = subjectMatch?.[1]?.trim();
  const body = bodyMatch?.[1]?.trim();
  const reasoning = reasoningMatch?.[1]?.trim();

  // Sanity-check: body must look like email content, not the raw AI response
  const safeBody = body && body.length > 5 && body.length < 5000 ? body : undefined;

  return {
    subject: subject && subject.length < 200 ? subject : defaultSubject,
    body: safeBody ?? response.trim(),
    reasoning: reasoning && reasoning.length < 1000 ? reasoning : defaultReasoning,
  };
}

function extractListItems(text: string, keyword: string): string[] {
  const lines = text.split("\n");
  const items: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.toLowerCase().includes(keyword)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      const cleaned = line.replace(/^[\d\-\*\.\)]+\s*/, "").trim();
      if (cleaned.length > 5 && cleaned.length < 200) {
        items.push(cleaned);
      }
      if (items.length >= 5 || (line.trim() === "" && items.length > 0)) {
        break;
      }
    }
  }

  return items.length > 0 ? items : ["Analyse beschikbaar in de volledige response"];
}

function extractSection(text: string, keyword: string): string | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(keyword)) {
      const nextLines = lines.slice(i + 1, i + 4).filter((l) => l.trim());
      return nextLines.join(" ").trim() || null;
    }
  }
  return null;
}
