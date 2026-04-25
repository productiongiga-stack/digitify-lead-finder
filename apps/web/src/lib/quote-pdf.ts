import { createHmac, timingSafeEqual } from "node:crypto";

export type QuotePdfItem = {
  id?: string;
  category?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  total?: number;
};

export type QuotePdfData = {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCompany?: string | null;
  clientAddress?: string | null;
  clientVat?: string | null;
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  createdAt: Date | string;
  validUntil?: Date | string | null;
  items: QuotePdfItem[];
};

type SettingsMap = Record<string, unknown>;

type PdfServiceCard = {
  title: string;
  subtitle?: string;
  bullets?: string[];
  color?: string;
};

type PdfProcessStep = {
  title: string;
  text: string;
};

type PdfTip = {
  title: string;
  text: string;
};

export type QuotePdfSettings = {
  brandName: string;
  brandTagline: string;
  logoUrl: string;
  headerBgColor: string;
  accentColor: string;
  pageBgColor: string;
  footerText: string;
  introTitle: string;
  introText: string;
  aboutTitle: string;
  aboutText: string;
  servicesTitle: string;
  servicesCards: PdfServiceCard[];
  processTitle: string;
  processSteps: PdfProcessStep[];
  tipsTitle: string;
  tips: PdfTip[];
  nextStepsTitle: string;
  nextSteps: string[];
  signatureClientTitle: string;
  signatureCompanyTitle: string;
  signatureCompanySigner: string;
  signatureCompanyRole: string;
};

const DEFAULT_SERVICES_CARDS: PdfServiceCard[] = [
  {
    title: "Webdesign",
    subtitle: "Snelle, conversiegerichte websites en webshops op maat.",
    bullets: ["Custom design", "Responsive", "SEO-gericht", "Conversie-optimalisatie"],
    color: "#E5A948",
  },
  {
    title: "Media",
    subtitle: "Sterke beelden met impact: social clips, fotoshoots en video.",
    bullets: ["Professionele montage", "Platform-specifieke output", "Kleurcorrectie", "Drone mogelijk"],
    color: "#6B4CD8",
  },
  {
    title: "Marketing",
    subtitle: "Datagedreven campagnes voor meetbare groei.",
    bullets: ["Google & Meta Ads", "Heldere rapportering", "Continue optimalisatie", "Online + offline"],
    color: "#3E63D8",
  },
  {
    title: "Extra's & Add-ons",
    subtitle: "Aanvullende services voor schaalbare groei.",
    bullets: ["Hosting & domein", "SEO-upgrades", "Onderhoud", "Branding"],
    color: "#499D66",
  },
];

const DEFAULT_PROCESS_STEPS: PdfProcessStep[] = [
  { title: "Discover", text: "Kennismaking, briefing en doelstellingen scherpstellen." },
  { title: "Create", text: "Strategie en concept op maat van uw merk." },
  { title: "Build", text: "Uitwerken, testen en opleveren met kwaliteitscontrole." },
  { title: "Grow", text: "Meten, bijsturen en verder schalen op data." },
];

const DEFAULT_TIPS: PdfTip[] = [
  { title: "Eerste 3 seconden tellen", text: "Start met een sterke opening. Zo houdt u de aandacht vast." },
  { title: "Consistentie wint", text: "Regelmatige publicatie presteert beter dan losse campagnes." },
  { title: "Hergebruik content", text: "Maak van een video meerdere snippets per platform." },
  { title: "Doelgroep centraal", text: "Focus op het probleem van de klant, niet op uzelf." },
  { title: "Ondertiteling verhoogt bereik", text: "Veel video wordt zonder geluid bekeken, captions helpen." },
  { title: "Format per platform", text: "Pas aspect ratio en lengte aan op elk kanaal." },
];

const DEFAULT_NEXT_STEPS = [
  "Lees de offerte volledig na en verzamel eventuele vragen.",
  "Onderteken digitaal of op papier en bezorg ons een kopie.",
  "Wij plannen de onboarding en projectstart in.",
  "We starten de uitvoering en rapporteren stap voor stap.",
];

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtCurrency(value: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function fmtDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function setting(settings: SettingsMap, key: string, fallback = "") {
  const raw = settings[key];
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "string") return raw.trim() || fallback;
  return String(raw);
}

function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  if (!value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    return parsed as T[];
  } catch {
    return fallback;
  }
}

function normalizeHex(color: string, fallback: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color.trim()) ? color.trim() : fallback;
}

function template(input: string, map: Record<string, string>) {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => map[key] ?? "");
}

function defaultFooterText(map: Record<string, string>) {
  return `${map.companyEmail} • ${map.companyPhone} • ${map.companyWebsite} • BTW: ${map.companyVat}`;
}

export function loadQuotePdfSettings(settings: SettingsMap): QuotePdfSettings {
  return {
    brandName: setting(settings, "quotes.pdf_brand_name", setting(settings, "branding.company_name", setting(settings, "company.name", "Digitify"))),
    brandTagline: setting(settings, "quotes.pdf_brand_tagline", "Partner in Digital Solutions"),
    logoUrl: setting(settings, "quotes.pdf_logo_url", setting(settings, "branding.logo_url", "")),
    headerBgColor: normalizeHex(setting(settings, "quotes.pdf_header_bg_color", "#0A0D12"), "#0A0D12"),
    accentColor: normalizeHex(setting(settings, "quotes.pdf_accent_color", setting(settings, "branding.primary_color", "#F6AD49")), "#F6AD49"),
    pageBgColor: normalizeHex(setting(settings, "quotes.pdf_page_bg_color", "#ECECEE"), "#ECECEE"),
    footerText: setting(settings, "quotes.pdf_footer_text", ""),
    introTitle: setting(settings, "quotes.pdf_intro_title", "Beste {{clientName}},"),
    introText: setting(settings, "quotes.pdf_intro_text", "Bedankt voor uw vertrouwen. Hieronder vindt u een gepersonaliseerde offerte op maat van uw doelstellingen."),
    aboutTitle: setting(settings, "quotes.pdf_about_title", "Over ons"),
    aboutText: setting(settings, "quotes.pdf_about_text", setting(settings, "company.profile", setting(settings, "branding.about", "Wij bouwen digitale oplossingen met focus op resultaat, schaalbaarheid en kwaliteit."))),
    servicesTitle: setting(settings, "quotes.pdf_services_title", "Onze diensten & aanpak"),
    servicesCards: parseJsonArray<PdfServiceCard>(setting(settings, "quotes.pdf_services_cards_json", ""), DEFAULT_SERVICES_CARDS),
    processTitle: setting(settings, "quotes.pdf_process_title", "Ons proces - van idee tot resultaat"),
    processSteps: parseJsonArray<PdfProcessStep>(setting(settings, "quotes.pdf_process_steps_json", ""), DEFAULT_PROCESS_STEPS),
    tipsTitle: setting(settings, "quotes.pdf_tips_title", "Tips & tricks - haal het meeste uit uw investering"),
    tips: parseJsonArray<PdfTip>(setting(settings, "quotes.pdf_tips_json", ""), DEFAULT_TIPS),
    nextStepsTitle: setting(settings, "quotes.pdf_next_steps_title", "Volgende stappen"),
    nextSteps: parseJsonArray<string>(setting(settings, "quotes.pdf_next_steps_json", ""), DEFAULT_NEXT_STEPS),
    signatureClientTitle: setting(settings, "quotes.pdf_signature_client_title", "Voor akkoord - Klant"),
    signatureCompanyTitle: setting(settings, "quotes.pdf_signature_company_title", "Voor akkoord - {{brandName}}"),
    signatureCompanySigner: setting(settings, "quotes.pdf_signature_company_signer", setting(settings, "email.from_name", "Team")),
    signatureCompanyRole: setting(settings, "quotes.pdf_signature_company_role", setting(settings, "email.from_title", "Zaakvoerder")),
  };
}

function buildServicesRows(items: QuotePdfItem[], accentColor: string) {
  return items
    .map((item) => {
      const total = Number.isFinite(item.total as number)
        ? Number(item.total)
        : Number(item.quantity || 0) * Number(item.unitPrice || 0);

      return `
        <tr>
          <td class="td-main">${esc(item.name)}</td>
          <td class="td-sub">${esc(item.category || "-")}</td>
          <td class="td-sub td-right">${esc(String(item.quantity || 0))}</td>
          <td class="td-sub td-right">${esc(fmtCurrency(Number(item.unitPrice || 0)))}</td>
          <td class="td-main td-right" style="color:${accentColor}">${esc(fmtCurrency(total))}</td>
        </tr>
        ${item.description ? `<tr><td colspan="5" class="td-note">${esc(item.description)}</td></tr>` : ""}
      `;
    })
    .join("\n");
}

export function buildQuotePdfHtml(params: {
  quote: QuotePdfData;
  settings: SettingsMap;
}) {
  const { quote } = params;
  const cfg = loadQuotePdfSettings(params.settings);
  const tokenMap = {
    clientName: quote.clientName || "Klant",
    clientCompany: quote.clientCompany || quote.clientName || "Klant",
    quoteNumber: quote.quoteNumber,
    validUntil: fmtDate(quote.validUntil),
    brandName: cfg.brandName,
    total: fmtCurrency(quote.total),
  };

  const companyEmail = setting(params.settings, "branding.email", setting(params.settings, "company.email", setting(params.settings, "email.from_email", "contact@digitify.be")));
  const companyPhone = setting(params.settings, "branding.phone", setting(params.settings, "company.phone", "+32 (0) 486 51 57 73"));
  const companyWebsite = setting(params.settings, "branding.website", setting(params.settings, "company.website", "www.digitify.be"));
  const companyAddress = setting(params.settings, "branding.address", setting(params.settings, "company.address", "-"));
  const companyVat = setting(params.settings, "branding.vat_number", setting(params.settings, "company.vat", "-"));

  const footerText = cfg.footerText || defaultFooterText({
    companyEmail,
    companyPhone,
    companyWebsite,
    companyVat,
  });

  const signatureCompanyTitle = template(cfg.signatureCompanyTitle, tokenMap);

  const pageHeader = (page: number) => `
    <header class="page-header" style="background:${cfg.headerBgColor};border-left:8px solid ${cfg.accentColor};">
      <div class="header-left">
        ${cfg.logoUrl ? `<img src="${esc(cfg.logoUrl)}" alt="${esc(cfg.brandName)}" class="logo"/>` : `<div class="brand">${esc(cfg.brandName)}</div>`}
        <div class="tagline" style="color:${cfg.accentColor}">${esc(cfg.brandTagline)}</div>
      </div>
      <div class="header-right">
        <div class="badge" style="background:${cfg.accentColor};">OFFERTE</div>
        <div class="quote-ref">${esc(quote.quoteNumber)}</div>
        <div class="quote-date">${esc(fmtDate(quote.createdAt))} · p.${page}</div>
      </div>
    </header>
  `;

  const pageFooter = `
    <footer class="page-footer" style="background:${cfg.headerBgColor};border-left:8px solid ${cfg.accentColor};">
      ${esc(footerText)}
    </footer>
  `;

  const servicesRows = buildServicesRows(quote.items || [], cfg.accentColor);

  const page1 = `
    <section class="pdf-page" style="background:${cfg.pageBgColor};">
      ${pageHeader(1)}
      <main class="page-main">
        <section class="cover-box" style="background:${cfg.headerBgColor};">
          <div class="cover-brand">${esc(cfg.brandName)}</div>
          <div class="cover-number">${esc(quote.quoteNumber)}</div>
          <div class="cover-valid">${esc(fmtDate(quote.createdAt))} · Geldig tot ${esc(fmtDate(quote.validUntil))}</div>
          <div class="cover-client">Opgesteld voor ${esc(quote.clientCompany || quote.clientName)}</div>
        </section>

        <div class="cards-2">
          <article class="panel">
            <div class="panel-title" style="background:${cfg.accentColor};">KLANTGEGEVENS</div>
            <div class="panel-body">
              <p><strong>${esc(quote.clientName || "-")}</strong></p>
              <p>${esc(quote.clientCompany || "-")}</p>
              <p>${esc(quote.clientAddress || "-")}</p>
              <p>${esc(quote.clientEmail || "-")}</p>
              <p>${esc(quote.clientPhone || "-")}</p>
              <p>BTW: ${esc(quote.clientVat || "-")}</p>
            </div>
          </article>
          <article class="panel">
            <div class="panel-title dark">${esc(cfg.brandName.toUpperCase())}</div>
            <div class="panel-body">
              <p><strong>${esc(cfg.brandName)}</strong></p>
              <p>${esc(companyAddress)}</p>
              <p>${esc(companyEmail)}</p>
              <p>${esc(companyPhone)}</p>
              <p>${esc(companyWebsite)}</p>
              <p>BTW: ${esc(companyVat)}</p>
            </div>
          </article>
        </div>

        <section class="text-block">
          <h2>${esc(template(cfg.introTitle, tokenMap))}</h2>
          <p>${esc(template(cfg.introText, tokenMap))}</p>
          <h3>${esc(template(cfg.aboutTitle, tokenMap))}</h3>
          <p>${esc(template(cfg.aboutText, tokenMap))}</p>
        </section>
      </main>
      ${pageFooter}
    </section>
  `;

  const serviceCards = (cfg.servicesCards || [])
    .slice(0, 6)
    .map(
      (card) => `
      <article class="service-card">
        <div class="service-title" style="background:${esc(normalizeHex(card.color || cfg.accentColor, cfg.accentColor))}">${esc(card.title)}</div>
        <p class="service-sub">${esc(card.subtitle || "")}</p>
        <ul>
          ${(card.bullets || []).slice(0, 6).map((bullet) => `<li>${esc(bullet)}</li>`).join("")}
        </ul>
      </article>
    `,
    )
    .join("\n");

  const processSteps = (cfg.processSteps || [])
    .slice(0, 6)
    .map(
      (step, idx) => `
      <article class="process-step">
        <div class="process-index" style="background:${cfg.accentColor}">${idx + 1}</div>
        <h4>${esc(step.title)}</h4>
        <p>${esc(step.text)}</p>
      </article>
    `,
    )
    .join("\n");

  const page2 = `
    <section class="pdf-page" style="background:${cfg.pageBgColor};">
      ${pageHeader(2)}
      <main class="page-main">
        <section class="section-head"><h3>${esc(template(cfg.servicesTitle, tokenMap))}</h3></section>
        <div class="services-grid">${serviceCards}</div>

        <section class="section-head"><h3>${esc(template(cfg.processTitle, tokenMap))}</h3></section>
        <div class="process-grid">${processSteps}</div>
      </main>
      ${pageFooter}
    </section>
  `;

  const notesBlock = quote.notes
    ? `<section class="notes-block"><h4>Opmerkingen</h4><p>${esc(quote.notes)}</p></section>`
    : "";

  const termsBlock = quote.terms
    ? `<section class="notes-block"><h4>Voorwaarden</h4><p>${esc(quote.terms)}</p></section>`
    : "";

  const page3 = `
    <section class="pdf-page" style="background:${cfg.pageBgColor};">
      ${pageHeader(3)}
      <main class="page-main">
        <section class="section-head"><h3>Offerte details - geselecteerde diensten</h3></section>
        <table class="details-table">
          <thead>
            <tr>
              <th>Omschrijving</th>
              <th>Categorie</th>
              <th class="td-right">St.</th>
              <th class="td-right">Prijs excl. BTW</th>
              <th class="td-right">Totaal</th>
            </tr>
          </thead>
          <tbody>
            ${servicesRows}
            <tr class="summary-row">
              <td colspan="4">Subtotaal excl. BTW</td>
              <td class="td-right">${esc(fmtCurrency(quote.subtotal))}</td>
            </tr>
            ${quote.discount > 0 ? `<tr class="summary-row"><td colspan="4">Korting</td><td class="td-right">-${esc(fmtCurrency(quote.discount))}</td></tr>` : ""}
            <tr class="summary-row">
              <td colspan="4">BTW (${esc(String(quote.vatRate))}%)</td>
              <td class="td-right">${esc(fmtCurrency(quote.vatAmount))}</td>
            </tr>
            <tr class="summary-total" style="background:${cfg.headerBgColor};">
              <td colspan="4">TOTAAL INCL. BTW</td>
              <td class="td-right" style="color:${cfg.accentColor}">${esc(fmtCurrency(quote.total))}</td>
            </tr>
          </tbody>
        </table>
        ${notesBlock}
        ${termsBlock}
      </main>
      ${pageFooter}
    </section>
  `;

  const tipsCards = (cfg.tips || [])
    .slice(0, 8)
    .map(
      (tip) => `
      <article class="tip-card">
        <h4>${esc(tip.title)}</h4>
        <p>${esc(tip.text)}</p>
      </article>
    `,
    )
    .join("\n");

  const nextSteps = (cfg.nextSteps || [])
    .slice(0, 8)
    .map(
      (step, index) => `
      <li><span class="step-badge" style="background:${cfg.accentColor}">${index + 1}</span>${esc(step)}</li>
    `,
    )
    .join("\n");

  const page4 = `
    <section class="pdf-page" style="background:${cfg.pageBgColor};">
      ${pageHeader(4)}
      <main class="page-main">
        <section class="section-head"><h3>${esc(template(cfg.tipsTitle, tokenMap))}</h3></section>
        <div class="tips-grid">${tipsCards}</div>

        <section class="section-head"><h3>${esc(template(cfg.nextStepsTitle, tokenMap))}</h3></section>
        <ol class="next-steps">${nextSteps}</ol>
      </main>
      ${pageFooter}
    </section>
  `;

  const page5 = `
    <section class="pdf-page" style="background:${cfg.pageBgColor};">
      ${pageHeader(5)}
      <main class="page-main">
        <section class="section-head"><h3>Akkoord & handtekeningen</h3></section>
        <section class="summary-signature">
          <p><strong>Offertesamenvatting</strong></p>
          <p>Datum: ${esc(fmtDate(quote.createdAt))} · Ref: ${esc(quote.quoteNumber)} · Geldig tot: ${esc(fmtDate(quote.validUntil))}</p>
          <p class="summary-total-line">${esc(fmtCurrency(quote.total))} incl. BTW</p>
        </section>
        <div class="sign-grid">
          <article class="sign-box">
            <div class="sign-title">${esc(template(cfg.signatureClientTitle, tokenMap))}</div>
            <div class="sign-inner">
              <p>Naam:</p>
              <div class="sign-line"></div>
              <p>Datum: ${esc(fmtDate(quote.createdAt))}</p>
              <div class="sign-line"></div>
            </div>
          </article>
          <article class="sign-box">
            <div class="sign-title dark">${esc(template(signatureCompanyTitle, tokenMap))}</div>
            <div class="sign-inner">
              <p>${esc(template(cfg.signatureCompanySigner, tokenMap))} - ${esc(template(cfg.signatureCompanyRole, tokenMap))}</p>
              <p>Naam:</p>
              <div class="sign-line"></div>
              <p>Datum: ${esc(fmtDate(quote.createdAt))}</p>
              <div class="sign-line"></div>
            </div>
          </article>
        </div>
      </main>
      ${pageFooter}
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background: #ffffff; color: #15171b; }
  .pdf-page { width: 210mm; min-height: 297mm; margin: 0 auto; display: flex; flex-direction: column; page-break-after: always; }
  .pdf-page:last-child { page-break-after: auto; }
  .page-header { display:flex; justify-content:space-between; align-items:flex-start; padding: 14mm 10mm 8mm 10mm; }
  .header-left .brand { font-size: 28px; font-weight: 800; color: #fff; }
  .tagline { margin-top: 3px; font-size: 12px; font-weight: 700; }
  .logo { max-height: 28px; display:block; margin-bottom: 4px; }
  .header-right { text-align: right; color: #9ca3af; }
  .badge { display:inline-block; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; color:#0f1115; letter-spacing: .08em; }
  .quote-ref { margin-top: 6px; font-size: 20px; font-weight: 800; color: #f4f6fa; }
  .quote-date { margin-top: 2px; font-size: 11px; }

  .page-main { flex: 1; padding: 5mm 10mm; }
  .section-head { border-left: 5px solid ${cfg.accentColor}; background: #f2f3f5; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
  .section-head h3 { margin:0; font-size: 22px; }

  .cover-box { border-radius: 12px; padding: 18px; color:#d6dae1; margin-bottom: 12px; }
  .cover-brand { font-size: 30px; font-weight: 800; color: #fff; }
  .cover-number { margin-top: 8px; display:inline-block; background: ${cfg.accentColor}; color:#101317; padding: 8px 14px; border-radius: 10px; font-weight:800; }
  .cover-valid { margin-top: 8px; font-size: 13px; }
  .cover-client { margin-top: 16px; font-size: 16px; font-weight: 700; color:#fff; }

  .cards-2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .panel { background: #e7e8ea; border-radius: 10px; overflow: hidden; }
  .panel-title { padding: 8px 12px; font-size: 13px; font-weight: 800; text-align: center; }
  .panel-title.dark { background: #12151b; color: #fff; }
  .panel-body { padding: 10px 12px; font-size: 12px; line-height: 1.45; color:#4e535c; }
  .panel-body p { margin: 0 0 4px 0; }

  .text-block { background: #f4f4f5; border: 1px solid #dedfe3; border-radius: 10px; padding: 12px; }
  .text-block h2 { margin:0 0 6px 0; font-size: 20px; }
  .text-block h3 { margin:10px 0 6px 0; font-size: 16px; }
  .text-block p { margin:0; font-size: 13px; line-height: 1.5; color:#4d5159; }

  .services-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .service-card { background:#eceef1; border: 1px solid #d9dce1; border-radius: 10px; padding: 10px; }
  .service-title { border-radius: 7px; padding: 6px 8px; font-size: 14px; font-weight: 800; text-align:center; color:#111318; margin-bottom: 8px; }
  .service-sub { margin: 0 0 7px 0; font-size: 12px; color:#555b65; }
  .service-card ul { margin: 0; padding-left: 16px; }
  .service-card li { margin-bottom: 4px; font-size: 12px; color:#38404a; }

  .process-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .process-step { border-radius: 10px; overflow: hidden; background: #12151b; color: #fff; padding: 10px; }
  .process-index { display:inline-flex; width: 28px; height: 28px; align-items:center; justify-content:center; border-radius: 50%; color:#15181d; font-weight: 800; font-size: 12px; }
  .process-step h4 { margin: 8px 0 5px 0; font-size: 14px; }
  .process-step p { margin:0; font-size: 11px; color:#b8bfca; line-height:1.4; }

  .details-table { width:100%; border-collapse: collapse; background:#f3f3f4; margin-bottom: 10px; }
  .details-table th { padding: 8px 10px; text-align:left; font-size: 12px; background:#12151b; color:${cfg.accentColor}; }
  .details-table td { border-bottom:1px solid #dcdee2; }
  .td-main { padding: 8px 10px; font-size: 12px; font-weight: 700; color:#1f252d; }
  .td-sub { padding: 8px 10px; font-size: 12px; color:#5c646f; }
  .td-note { padding: 6px 10px 10px 10px; font-size: 11px; color:#6a707a; background:#eef1f4; }
  .td-right { text-align:right; }
  .summary-row td { padding: 8px 10px; font-size: 12px; font-weight: 700; color:#28303b; background:#e7e8eb; }
  .summary-total td { padding: 9px 10px; font-size: 14px; font-weight: 800; color:#e8ebf0; }

  .notes-block { border: 1px solid #dcdee2; background:#f3f4f5; border-radius: 10px; padding: 9px 10px; margin-top: 8px; }
  .notes-block h4 { margin:0 0 5px 0; font-size: 12px; color:#3b4350; text-transform: uppercase; letter-spacing: .03em; }
  .notes-block p { margin:0; font-size: 12px; color:#4f5662; white-space: pre-wrap; }

  .tips-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .tip-card { background:#f0f1f3; border-left: 5px solid ${cfg.accentColor}; border-radius: 8px; padding: 10px; }
  .tip-card h4 { margin:0 0 6px 0; font-size: 14px; }
  .tip-card p { margin:0; font-size: 12px; color:#4e5560; line-height:1.45; }

  .next-steps { margin: 0; padding: 0; list-style: none; }
  .next-steps li { display:flex; align-items:flex-start; gap: 8px; margin-bottom: 8px; font-size: 13px; color:#2f3741; }
  .step-badge { width: 22px; height: 22px; border-radius: 50%; display:inline-flex; align-items:center; justify-content:center; font-size: 11px; font-weight: 800; color:#11141a; flex: 0 0 22px; }

  .summary-signature { background:#f1f2f4; border-radius: 10px; border-left: 5px solid ${cfg.accentColor}; padding: 10px 12px; margin-bottom: 10px; }
  .summary-signature p { margin:0 0 4px 0; font-size: 12px; color:#4a515c; }
  .summary-total-line { font-size: 20px !important; font-weight: 800; color:#13161b !important; }
  .sign-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sign-box { border-radius: 10px; overflow: hidden; background:#eceef1; border:1px solid #d9dce1; }
  .sign-title { background:${cfg.accentColor}; color:#101218; padding: 8px 10px; font-size: 13px; font-weight: 800; text-align:center; }
  .sign-title.dark { background:#12151b; color:#fff; }
  .sign-inner { padding: 10px; font-size: 12px; color:#4a515d; }
  .sign-inner p { margin: 0 0 5px 0; }
  .sign-line { border-bottom: 1px solid #c8cdd4; height: 18px; margin-bottom: 8px; }

  .page-footer { margin-top: auto; padding: 8px 10mm; color:#8f96a2; font-size: 10.5px; text-align:center; }

  @media print {
    @page { size: A4; margin: 0; }
    body { margin: 0; }
  }
</style>
</head>
<body>
  ${page1}
  ${page2}
  ${page3}
  ${page4}
  ${page5}
</body>
</html>`;
}

export async function renderQuotePdfBuffer(html: string): Promise<Buffer> {
  const playwright = await import("playwright-core");
  const chromiumModule = await import("@sparticuz/chromium");
  const chromium = chromiumModule.default;

  const launchWithServerlessChromium = async () => {
    const executablePath = await chromium.executablePath();
    return playwright.chromium.launch({
      executablePath,
      args: chromium.args,
      headless: true,
      chromiumSandbox: false,
    });
  };

  const launchWithDefaultChromium = async () =>
    playwright.chromium.launch({
      headless: true,
    });

  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>> | null = null;

  try {
    try {
      browser = await launchWithServerlessChromium();
    } catch {
      browser = await launchWithDefaultChromium();
    }

    const page = await browser.newPage({ viewport: { width: 1280, height: 1810 } });
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      preferCSSPageSize: true,
    });

    await page.close();
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}

function getTokenSecret() {
  const secret = process.env.QUOTE_PDF_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("QUOTE_PDF_TOKEN_SECRET or NEXTAUTH_SECRET must be set");
  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getTokenSecret()).update(payload).digest("base64url");
}

export function createQuotePdfToken(quoteId: string, validUntil?: Date | string | null) {
  const requestedExpiry = validUntil ? new Date(validUntil).getTime() : NaN;
  const fallbackExpiry = Date.now() + 1000 * 60 * 60 * 24 * 90;
  const expiresAt = Number.isFinite(requestedExpiry) && requestedExpiry > Date.now()
    ? requestedExpiry
    : fallbackExpiry;

  const payload = `${quoteId}.${expiresAt}`;
  const signature = signPayload(payload);
  return `${expiresAt}.${signature}`;
}

export function verifyQuotePdfToken(quoteId: string, token: string | null) {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!expiresRaw || !signature || !Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  const payload = `${quoteId}.${expiresAt}`;
  const expected = signPayload(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
