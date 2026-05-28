import { WebsiteAnalysis } from "./types";

function isValidEmail(email: string): boolean {
  // Reject obviously invalid patterns: starts/ends with dot, double dots, missing TLD, etc.
  if (/^\.|\.$|\.{2,}/.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain) return false;
  if (local.length > 64 || domain.length > 255) return false;
  // Domain must have at least one dot and a valid TLD (2+ chars)
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1]!;
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
  return true;
}

function extractEmails(html: string): string[] {
  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(regex) || [];
  const blocked = ["@example", "@sentry", "wixpress", "@2x", "@3x", ".png@", ".jpg@"];
  return [...new Set(matches)].filter(
    (e) => !blocked.some((b) => e.includes(b)) && isValidEmail(e)
  );
}

function extractPhones(html: string): string[] {
  const regex = /(?:\+32|0)[\s.-]?\d[\s.-]?\d{2,3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
  const matches = html.match(regex) || [];
  return [...new Set(matches.map((p) => p.replace(/[\s.-]/g, "")))];
}

function extractSocialLinks(html: string) {
  const find = (pattern: RegExp) => {
    const match = html.match(pattern);
    return match ? match[0] : null;
  };

  return {
    facebook: find(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9._-]+/),
    instagram: find(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._-]+/),
    linkedin: find(/https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9._-]+/),
    twitter: find(/https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9._-]+/),
    youtube: find(/https?:\/\/(www\.)?youtube\.com\/(channel|c|@)[\/a-zA-Z0-9._-]+/),
    tiktok: find(/https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+/),
  };
}

function detectTechnologies(html: string): string[] {
  const techs: string[] = [];
  if (html.includes("wp-content") || html.includes("wordpress")) techs.push("WordPress");
  if (html.includes("Shopify")) techs.push("Shopify");
  if (html.includes("wix.com")) techs.push("Wix");
  if (html.includes("squarespace")) techs.push("Squarespace");
  if (html.includes("webflow")) techs.push("Webflow");
  if (html.includes("joomla")) techs.push("Joomla");
  if (html.includes("drupal")) techs.push("Drupal");
  if (html.includes("google-analytics") || html.includes("gtag") || html.includes("GA4")) techs.push("Google Analytics");
  if (html.includes("gtm.js") || html.includes("googletagmanager")) techs.push("Google Tag Manager");
  if (html.includes("fbq(") || html.includes("facebook.com/tr")) techs.push("Facebook Pixel");
  if (html.includes("hotjar")) techs.push("Hotjar");
  if (html.includes("crisp")) techs.push("Crisp Chat");
  if (html.includes("intercom")) techs.push("Intercom");
  if (html.includes("tawk.to")) techs.push("Tawk.to");
  if (html.includes("bootstrap")) techs.push("Bootstrap");
  if (html.includes("tailwind")) techs.push("Tailwind CSS");
  if (html.includes("react")) techs.push("React");
  if (html.includes("next") && html.includes("_next")) techs.push("Next.js");
  return techs;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; DigitifyWebsiteAuditor/1.0)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "nl,en;q=0.9",
};

function extractInternalUrls(html: string, baseUrl: URL, max = 12): string[] {
  const hrefRegex = /href=["']([^"'#]+)["']/gi;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) {
      continue;
    }
    try {
      const resolved = new URL(raw, baseUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      if (resolved.hostname !== baseUrl.hostname) continue;
      if (/\.(pdf|zip|png|jpe?g|gif|webp|svg|ico|css|js|woff2?)$/i.test(resolved.pathname)) continue;
      resolved.hash = "";
      found.add(resolved.toString());
    } catch {
      // ignore invalid URLs
    }
  }
  return [...found].slice(0, max);
}

function countUxSignals(html: string) {
  const linkMatches = html.match(/<a\b[^>]*href=/gi) || [];
  const buttonMatches =
    html.match(/<button\b/gi) ||
    [];
  const inputButtons = html.match(/<input[^>]*type=["'](button|submit)["']/gi) || [];
  const roleButtons = html.match(/role=["']button["']/gi) || [];
  const formMatches = html.match(/<form\b/gi) || [];
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imagesMissingAlt = imgTags.filter((tag) => !/\balt=["'][^"']+["']/i.test(tag)).length;

  return {
    linkCount: linkMatches.length,
    buttonCount: buttonMatches.length + inputButtons.length + roleButtons.length,
    formCount: formMatches.length,
    imagesTotal: imgTags.length,
    imagesMissingAlt,
  };
}

async function probePage(url: string): Promise<{
  url: string;
  statusCode: number;
  ok: boolean;
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    clearTimeout(timeout);
    return {
      url,
      statusCode: response.status,
      ok: response.status >= 200 && response.status < 400,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return { url, statusCode: 0, ok: false, error: message };
  }
}

async function probeInternalPages(homeUrl: string, html: string) {
  let base: URL;
  try {
    base = new URL(homeUrl);
  } catch {
    return { pageProbes: [] as { url: string; statusCode: number; ok: boolean; error?: string }[], pagesChecked: 0, pagesBroken: 0, internalLinkCount: 0 };
  }

  const internalUrls = extractInternalUrls(html, base, 10);
  const toCheck = [base.toString(), ...internalUrls.filter((u) => u !== base.toString())].slice(0, 8);
  const pageProbes: { url: string; statusCode: number; ok: boolean; error?: string }[] = [];

  for (const pageUrl of toCheck) {
    pageProbes.push(await probePage(pageUrl));
  }

  const pagesBroken = pageProbes.filter((p) => !p.ok).length;
  return {
    pageProbes,
    pagesChecked: pageProbes.length,
    pagesBroken,
    internalLinkCount: internalUrls.length,
  };
}

function hasCTA(html: string): boolean {
  // Check for actual <form> elements first (most reliable CTA indicator)
  if (/<form[^>]*>/i.test(html)) return true;
  // Check for CTA button/link text patterns
  const ctaPatterns = [
    /contact/i, /offerte/i, /afspraak/i, /bel ons/i, /neem contact/i,
    /get started/i, /book now/i, /request quote/i, /free consultation/i,
    /gratis/i, /aanvragen/i, /reserveer/i, /bestel/i,
  ];
  return ctaPatterns.some((p) => p.test(html));
}

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const errors: string[] = [];
  let html = "";
  let statusCode = 0;
  let loadTimeMs = 0;
  let hasSSL = false;
  let lastModified: string | null = null;

  try {
    // Normalize URL
    if (!url.startsWith("http")) {
      url = `https://${url}`;
    }
    hasSSL = url.startsWith("https://");

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: FETCH_HEADERS,
        redirect: "follow",
      });

      clearTimeout(timeout);
      loadTimeMs = Date.now() - start;
      statusCode = response.status;
      lastModified = response.headers.get("last-modified");

      // Check if redirected to HTTPS
      if (response.url.startsWith("https://")) hasSSL = true;

      html = await response.text();
    } catch (fetchError: any) {
      clearTimeout(timeout);
      loadTimeMs = Date.now() - start;

      if (fetchError.name === "AbortError") {
        errors.push("Timeout na 15 seconden");
        loadTimeMs = 15000;
      } else {
        errors.push(`Fetch error: ${fetchError.message}`);
      }

      // Try HTTP fallback if HTTPS failed
      if (url.startsWith("https://")) {
        try {
          const httpUrl = url.replace("https://", "http://");
          const fallbackResp = await fetch(httpUrl, {
            headers: FETCH_HEADERS,
            redirect: "follow",
          });
          html = await fallbackResp.text();
          statusCode = fallbackResp.status;
          hasSSL = false;
          errors.push("Alleen bereikbaar via HTTP (geen SSL)");
        } catch {
          // Both failed
        }
      }
    }
  } catch (error: any) {
    errors.push(`Analysis error: ${error.message}`);
  }

  const htmlLower = html.toLowerCase();

  // Extract meta tags
  const metaTitleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const metaTitle = metaTitleMatch ? metaTitleMatch[1].trim() : null;

  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]*>/g, "").trim() : null;

  // Check for viewport meta (mobile-friendly indicator)
  const hasViewport = /meta[^>]*name=["']viewport["']/i.test(html);

  // Check for structured data
  const hasStructuredData =
    html.includes("application/ld+json") ||
    html.includes("itemtype=") ||
    html.includes("vocab=\"https://schema.org\"");

  // Check for favicon
  const hasFavicon =
    html.includes("favicon") ||
    html.includes("shortcut icon") ||
    html.includes("apple-touch-icon");

  // Check for analytics
  const hasAnalytics =
    htmlLower.includes("google-analytics") ||
    htmlLower.includes("gtag(") ||
    htmlLower.includes("googletagmanager") ||
    htmlLower.includes("fbq(") ||
    htmlLower.includes("hotjar") ||
    htmlLower.includes("analytics");

  const uxSignals = countUxSignals(html);
  const pageProbeResult =
    html.length > 0 && statusCode > 0
      ? await probeInternalPages(url, html)
      : {
          pageProbes: [] as { url: string; statusCode: number; ok: boolean; error?: string }[],
          pagesChecked: 0,
          pagesBroken: 0,
          internalLinkCount: 0,
        };

  return {
    url,
    statusCode,
    hasSSL,
    isMobileFriendly: hasViewport,
    loadTimeMs,
    hasMetaTitle: !!metaTitle && metaTitle.length > 0,
    metaTitle,
    hasMetaDescription: !!metaDescription && metaDescription.length > 0,
    metaDescription,
    hasH1: !!h1Text,
    h1Text,
    hasStructuredData,
    hasFavicon,
    hasAnalytics,
    hasCTA: hasCTA(html),
    contentLength: html.length,
    lastModified,
    technologies: detectTechnologies(htmlLower),
    socialLinks: extractSocialLinks(html),
    contactInfo: {
      emails: extractEmails(html),
      phones: extractPhones(html),
    },
    uxAudit: {
      ...uxSignals,
      internalLinkCount: pageProbeResult.internalLinkCount,
      pageProbes: pageProbeResult.pageProbes,
      pagesChecked: pageProbeResult.pagesChecked,
      pagesBroken: pageProbeResult.pagesBroken,
    },
    errors,
  };
}
