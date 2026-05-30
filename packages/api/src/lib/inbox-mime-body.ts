function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodePartBody(headersBlock: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/Content-Transfer-Encoding:\s*base64/i.test(headersBlock)) {
    try {
      return Buffer.from(trimmed.replace(/\s/g, ""), "base64").toString("utf-8");
    } catch {
      return trimmed;
    }
  }
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(headersBlock)) {
    return decodeQuotedPrintable(trimmed);
  }
  return trimmed;
}

function collectMimeParts(raw: string, contentType: "text/plain" | "text/html"): string[] {
  const parts: string[] = [];
  const pattern = new RegExp(
    `Content-Type:\\s*${contentType.replace("/", "\\/")}[^\\r\\n]*(?:[\\r\\n]+[^\\r\\n:]+:[^\\r\\n]*)*\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n--[^\\r\\n]|$)`,
    "gi",
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const headerStart = Math.max(0, match.index - 400);
    const headersBlock = raw.slice(headerStart, match.index + 200);
    const decoded = decodePartBody(headersBlock, match[1] || "");
    if (decoded.trim()) parts.push(decoded.trim());
  }
  return parts;
}

export function extractHtmlFromRaw(raw: string): string {
  const htmlParts = collectMimeParts(raw, "text/html");
  if (!htmlParts.length) return "";
  return htmlParts.sort((a, b) => b.length - a.length)[0] || "";
}

export function extractTextFromRaw(raw: string): string {
  const textParts = collectMimeParts(raw, "text/plain");
  if (!textParts.length) return "";
  return textParts.sort((a, b) => b.length - a.length)[0] || "";
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Prefer plain text; fall back to HTML converted to readable text. */
export function emailBodyForAi(input: { text?: string | null; html?: string | null; raw?: string | null }) {
  const fromRaw = input.raw ? extractTextFromRaw(input.raw) || htmlToPlainText(extractHtmlFromRaw(input.raw)) : "";
  const plain = input.text?.trim() || "";
  const fromHtml = input.html?.trim() ? htmlToPlainText(input.html) : "";
  const best = [plain, fromHtml, fromRaw].sort((a, b) => b.length - a.length)[0] || "";
  return best.slice(0, 12_000);
}
