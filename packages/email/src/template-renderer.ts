import type { TemplateContext } from "./types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderTemplate(template: string, context: TemplateContext): string {
  let result = template;

  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "g");
      result = result.replace(regex, () => value);
    }
  }

  // Remove any remaining unresolved placeholders
  result = result.replace(/\{\{\s*\w+\s*\}\}/g, "");

  return result;
}

export function renderSubject(subject: string, context: TemplateContext): string {
  return renderTemplate(subject, context);
}

export function htmlFromText(text: string): string {
  return text
    .split("\n\n")
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
