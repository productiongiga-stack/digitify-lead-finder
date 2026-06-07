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

/** Email shell / branded preview — preserves table layout inline styles. */
const EMAIL_SHELL_ALLOWED_TAGS = [
  ...INBOX_ALLOWED_TAGS,
  "html",
  "head",
  "body",
  "meta",
];

const EMAIL_SHELL_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel", "style"],
  img: ["src", "alt", "width", "height", "title", "style"],
  td: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "style"],
  th: ["colspan", "rowspan", "align", "valign", "width", "style"],
  tr: ["align", "valign", "style"],
  tbody: ["style"],
  thead: ["style"],
  table: ["width", "border", "cellpadding", "cellspacing", "role", "align", "style"],
  span: ["style"],
  div: ["style", "align"],
  p: ["style", "align"],
  body: ["style"],
  html: ["lang"],
  meta: ["charset", "name", "content", "http-equiv"],
  font: ["color", "face", "size"],
};

const PLACEHOLDER_HREF_RE = /^\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}$/;

function sanitizeAnchor(tagName: string, attribs: sanitizeHtml.Attributes) {
  if (tagName !== "a" || !attribs.href) {
    return { tagName, attribs };
  }
  const href = attribs.href.trim();
  const lower = href.toLowerCase();
  const isPlaceholder = PLACEHOLDER_HREF_RE.test(href);
  if (
    isPlaceholder ||
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

/** Sanitize workspace master-shell HTML while keeping email-safe inline styles. */
export function sanitizeEmailShellHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: EMAIL_SHELL_ALLOWED_TAGS,
    allowedAttributes: EMAIL_SHELL_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeAnchor,
    },
  });
}

export function isFullHtmlEmailDocument(html: string) {
  const trimmed = html.trim();
  return /^<!doctype/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
}

/** Build iframe document for previews (shell or fragment). */
export function buildEmailPreviewDocument(html: string): string {
  const trimmed = html.trim();
  if (isFullHtmlEmailDocument(trimmed)) {
    const safe = sanitizeEmailShellHtml(trimmed);
    if (!/<head[\s>]/i.test(safe)) {
      return safe;
    }
    const previewReset = `<style>a[style]{color:inherit !important;text-decoration:none !important;}</style>`;
    return safe.replace(/<head([^>]*)>/i, `<head$1>${previewReset}`);
  }
  return buildInboxHtmlDocument(sanitizeInboxHtml(trimmed));
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
