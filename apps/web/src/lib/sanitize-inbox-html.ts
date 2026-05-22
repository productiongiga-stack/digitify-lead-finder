import sanitizeHtml from "sanitize-html";

const INBOX_ALLOWED_TAGS = [
  "p",
  "br",
  "b",
  "i",
  "u",
  "strong",
  "em",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "span",
  "div",
  "hr",
  "pre",
  "code",
  "font",
];

const INBOX_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "width", "height", "title"],
  td: ["colspan", "rowspan", "align", "valign"],
  th: ["colspan", "rowspan", "align", "valign"],
  table: ["width", "border", "cellpadding", "cellspacing"],
  span: ["style"],
  div: ["style"],
  p: ["style"],
  font: ["color", "face", "size"],
};

function sanitizeAnchor(tagName: string, attribs: sanitizeHtml.Attributes) {
  if (tagName !== "a" || !attribs.href) {
    return { tagName, attribs };
  }
  const href = attribs.href.trim();
  const lower = href.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    (href.startsWith("/") && !href.startsWith("//"))
  ) {
    return {
      tagName: "a",
      attribs: {
        ...attribs,
        href,
        rel: "noopener noreferrer",
        target: "_blank",
      },
    };
  }
  return { tagName: "span", attribs: {} };
}

export function sanitizeInboxHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: INBOX_ALLOWED_TAGS,
    allowedAttributes: INBOX_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeAnchor,
    },
  });
}

export function buildInboxHtmlDocument(safeBodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:; base-uri 'none'; form-action 'none';">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; padding: 16px; margin: 0; line-height: 1.6; }
    img { max-width: 100%; height: auto; }
    a { color: #6366f1; }
    pre, code { white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>${safeBodyHtml}</body>
</html>`;
}
