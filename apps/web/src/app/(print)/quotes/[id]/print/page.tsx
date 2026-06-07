"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function addDays(date: Date | string, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const CATEGORY_LABELS: Record<string, string> = {
  webdesign: "Webdesign",
  media: "Media",
  marketing: "Marketing",
  extras: "Extra",
  overig: "Overig",
};

export default function QuotePrintPage() {
  const params = useParams();
  const id = params.id as string;
  const [ready, setReady] = useState(false);

  const { data: quote, isLoading: quoteLoading, isError: quoteError } = trpc.quote.getById.useQuery({ id });
  const { data: settings, isLoading: settingsLoading, isError: settingsError } =
    trpc.settings.getBranding.useQuery(undefined, {
      staleTime: 60_000,
    });

  const company = useMemo(() => {
    const map = settings || {};
    const name =
      String(map["branding.company_name"] || map["company.name"] || "Digitify");
    const email = String(map["branding.email"] || map["company.email"] || map["email.from_email"] || "");
    const phone = String(map["branding.phone"] || map["company.phone"] || "+32 (0) 486 51 57 73");
    const website = String(map["branding.website"] || map["company.website"] || "www.digitify.be");
    const address = String(map["branding.address"] || map["company.address"] || "Boekweitstraat 7, 9000 Gent, België");
    const vat = String(map["branding.vat_number"] || map["company.vat"] || "BE0685556507");
    const logoUrl = String(map["branding.logo_url"] || "");
    const primaryColor = String(map["branding.primary_color"] || "#f6ad49");
    const profile = String(
      map["company.profile"] ||
      map["branding.about"] ||
      "Bij Digitify combineren we design, technologie en strategie tot digitale oplossingen die echt resultaat opleveren: meetbaar, duurzaam en volledig op maat.",
    );
    const signatureName = String(map["email.from_name"] || "Klim Gaikalov");
    const signatureTitle = String(map["email.from_title"] || "Zaakvoerder");
    return {
      name,
      email,
      phone,
      website,
      address,
      vat,
      logoUrl,
      primaryColor: primaryColor === "#6366f1" ? "#f6ad49" : primaryColor,
      profile,
      signatureName,
      signatureTitle,
    };
  }, [settings]);
  const typographyMode = settings?.["display.typography_mode"] === "normal" ? "normal" : "compact";
  const px = (compact: number, normal: number) => (typographyMode === "normal" ? normal : compact);

  useEffect(() => {
    if (!quoteLoading && !settingsLoading && quote && settings) {
      setReady(true);
    }
  }, [quoteLoading, quote, settingsLoading, settings]);

  if ((!quoteLoading && (quoteError || !quote)) || (!settingsLoading && settingsError)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#991b1b" }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Offerte kan niet worden geladen.</p>
          <p style={{ fontSize: 13, color: "#666" }}>Controleer of de link klopt en probeer opnieuw.</p>
        </div>
      </div>
    );
  }

  if (!ready || !quote) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid #ddd", borderTopColor: "#f6ad49", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ fontSize: px(13, 14), color: "#666" }}>Offerte laden...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const validUntil = quote.validUntil ? formatDate(quote.validUntil) : formatDate(addDays(quote.createdAt, 30));
  const createdAt = formatDate(quote.createdAt);
  const clientCompany = quote.clientCompany || quote.clientName;
  const introName = quote.clientName || clientCompany;
  const items = quote.items || [];

  return (
    <>
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          @page {
            margin: 10mm;
            size: A4;
          }
          .no-print { display: none !important; }
          .page { box-shadow: none !important; margin: 0 !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          table, tr, td, th { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen {
          body { background: #d9d9dd !important; }
        }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 14, right: 14, zIndex: 40, display: "flex", gap: 8 }}>
        <button
          onClick={() => window.open(`/api/quotes/${id}/pdf`, "_blank")}
          style={{
            border: "none",
            borderRadius: 8,
            background: company.primaryColor,
            color: "#111",
            fontWeight: 700,
            fontSize: px(13, 14),
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Download PDF
        </button>
        <button
          onClick={() => window.print()}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#fff",
            color: "#111827",
            fontWeight: 600,
            fontSize: px(13, 14),
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Afdrukken
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#fff",
            color: "#111",
            fontWeight: 500,
            fontSize: px(13, 14),
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          Terug
        </button>
      </div>

      <div
        className="page"
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          maxWidth: 794,
          margin: "18px auto",
          background: "#ececee",
          color: "#111827",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <section style={{ background: "#090b10", padding: "34px 36px 28px 36px", borderLeft: `12px solid ${company.primaryColor}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
            <div>
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} style={{ height: 56, objectFit: "contain", marginBottom: 10 }} />
              ) : (
                <div style={{ fontSize: px(56, 62), lineHeight: 1, fontWeight: 800, color: "#fff", letterSpacing: "-2px", marginBottom: 6 }}>
                  {company.name}
                </div>
              )}
              <div style={{ fontSize: px(18, 20), fontWeight: 700, color: company.primaryColor }}>
                Partner in Digital Solutions
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-block", background: company.primaryColor, color: "#111", borderRadius: 999, padding: "6px 14px", fontSize: px(13, 14), fontWeight: 800, letterSpacing: 1 }}>
                OFFERTE
              </div>
              <div style={{ marginTop: 12, fontSize: px(34, 38), fontWeight: 800, color: "#f2f4f7" }}>{quote.quoteNumber}</div>
              <div style={{ marginTop: 4, fontSize: px(14, 15), color: "#9ca3af" }}>
                {createdAt} · Geldig tot {validUntil}
              </div>
            </div>
          </div>
        </section>

        <div style={{ height: 4, background: company.primaryColor }} />

        <section className="avoid-break" style={{ padding: "26px 36px 10px 36px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ borderRadius: 12, background: "#e3e4e6", overflow: "hidden" }}>
              <div style={{ background: company.primaryColor, color: "#111", fontWeight: 800, fontSize: px(18, 20), textAlign: "center", padding: "10px 12px" }}>KLANTGEGEVENS</div>
              <div style={{ padding: "16px 18px", fontSize: px(14, 15), lineHeight: 1.6, color: "#4b5563" }}>
                <div style={{ fontSize: px(17, 19), fontWeight: 800, color: "#111", marginBottom: 2 }}>{quote.clientName}</div>
                <div style={{ fontSize: px(15, 16), fontWeight: 700, color: "#374151" }}>{clientCompany}</div>
                {quote.clientAddress ? <div>{quote.clientAddress}</div> : null}
                {quote.clientEmail ? <div style={{ color: "#2563eb" }}>{quote.clientEmail}</div> : null}
                {quote.clientPhone ? <div>{quote.clientPhone}</div> : null}
                {quote.clientVat ? <div>BTW: {quote.clientVat}</div> : null}
              </div>
            </div>

            <div style={{ borderRadius: 12, background: "#e3e4e6", overflow: "hidden" }}>
              <div style={{ background: "#0a0d12", color: "#fff", fontWeight: 800, fontSize: px(18, 20), textAlign: "center", padding: "10px 12px" }}>
                {company.name.toUpperCase()}
              </div>
              <div style={{ padding: "16px 18px", fontSize: px(14, 15), lineHeight: 1.6, color: "#4b5563" }}>
                <div style={{ fontSize: px(17, 19), fontWeight: 800, color: "#111" }}>{company.name}</div>
                <div>{company.address}</div>
                {company.email ? <div>{company.email}</div> : null}
                {company.phone ? <div>{company.phone}</div> : null}
                {company.website ? <div>{company.website}</div> : null}
                {company.vat ? <div>BTW: {company.vat}</div> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="avoid-break" style={{ padding: "0 36px 8px 36px" }}>
          <div style={{ borderTop: "2px solid #d5d7db", marginTop: 10, paddingTop: 16 }}>
            <p style={{ margin: "0 0 8px 0", fontSize: px(32, 36), fontWeight: 800, color: "#1a1d23" }}>
              Beste {introName},
            </p>
            <p style={{ margin: "0 0 8px 0", fontSize: px(16, 17), lineHeight: 1.5, color: "#4d5158" }}>
              Bedankt voor uw vertrouwen in {company.name} en de interesse vanuit {clientCompany}. Hierbij ontvangt u een persoonlijke offerte op maat, opgesteld op basis van uw doelstellingen.
            </p>
            <p style={{ margin: "0 0 8px 0", fontSize: px(16, 17), lineHeight: 1.5, color: "#4d5158" }}>
              {company.profile}
            </p>
            <p style={{ margin: 0, fontSize: px(16, 17), lineHeight: 1.5, color: "#4d5158" }}>
              Deze offerte is geldig tot {validUntil}. Heeft u vragen of wenst u aanpassingen, dan helpen we u graag verder via {company.email || "e-mail"} of {company.phone || "telefoon"}.
            </p>
          </div>
        </section>

        <section className="avoid-break" style={{ padding: "8px 36px 12px 36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
            <div style={{ fontSize: px(18, 20), fontWeight: 800, letterSpacing: 0.5, color: "#8b8e95" }}>OVERZICHT DIENSTEN</div>
            <div style={{ fontSize: px(13, 14), color: "#6b7280" }}>Datum: {createdAt}</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#f0f1f2" }}>
            <thead>
              <tr style={{ background: "#0a0d12" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: px(13, 14), color: company.primaryColor, letterSpacing: 0.6 }}>DIENST</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: px(13, 14), color: "#8b8e95", letterSpacing: 0.6 }}>CATEGORIE</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: px(13, 14), color: "#8b8e95", letterSpacing: 0.6 }}>EXCL. BTW</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: px(13, 14), color: company.primaryColor, letterSpacing: 0.6 }}>TOTAAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const lineTotal = item.quantity * item.unitPrice;
                return (
                  <tr key={item.id || index} style={{ borderBottom: "1px solid #dee0e2" }}>
                    <td style={{ padding: "9px 12px", fontSize: px(15, 16), fontWeight: 700, color: "#1f2937" }}>{item.name}</td>
                    <td style={{ padding: "9px 12px", fontSize: px(14, 15), color: "#6b7280" }}>
                      {CATEGORY_LABELS[item.category || "overig"] || item.category || "Overig"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontSize: px(14, 15), color: "#6b7280" }}>
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontSize: px(15, 16), fontWeight: 800, color: company.primaryColor }}>
                      {formatCurrency(lineTotal)}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: "#e5e6e8" }}>
                <td colSpan={3} style={{ padding: "12px", textAlign: "right", fontSize: px(16, 17), fontWeight: 800, color: "#111" }}>
                  Totaal excl. korting
                </td>
                <td style={{ padding: "12px", textAlign: "right", fontSize: px(18, 20), fontWeight: 800, color: company.primaryColor }}>
                  {formatCurrency(quote.subtotal)}
                </td>
              </tr>
              {quote.discount > 0 ? (
                <tr style={{ background: "#e5e6e8" }}>
                  <td colSpan={3} style={{ padding: "8px 12px", textAlign: "right", fontSize: px(14, 15), color: "#b91c1c" }}>
                    Korting
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontSize: px(14, 15), fontWeight: 700, color: "#b91c1c" }}>
                    -{formatCurrency(quote.discount)}
                  </td>
                </tr>
              ) : null}
              <tr style={{ background: "#e5e6e8" }}>
                <td colSpan={3} style={{ padding: "8px 12px", textAlign: "right", fontSize: px(14, 15), color: "#4b5563" }}>
                  BTW ({quote.vatRate}%)
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontSize: px(14, 15), fontWeight: 700, color: "#4b5563" }}>
                  {formatCurrency(quote.vatAmount)}
                </td>
              </tr>
              <tr style={{ background: "#0a0d12" }}>
                <td colSpan={3} style={{ padding: "12px", textAlign: "right", fontSize: px(16, 17), fontWeight: 800, color: "#e5e7eb" }}>
                  Totaal incl. BTW
                </td>
                <td style={{ padding: "12px", textAlign: "right", fontSize: px(28, 32), fontWeight: 800, color: company.primaryColor }}>
                  {formatCurrency(quote.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {(quote.notes || quote.terms) ? (
          <section className="avoid-break" style={{ padding: "2px 36px 18px 36px" }}>
            <div style={{ display: "grid", gridTemplateColumns: quote.notes && quote.terms ? "1fr 1fr" : "1fr", gap: 14 }}>
              {quote.notes ? (
                <div style={{ background: "#e7e7e8", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: px(12, 13), letterSpacing: 0.6, fontWeight: 800, color: "#8b8e95", marginBottom: 5 }}>OPMERKINGEN</div>
                  <div style={{ fontSize: px(13, 14), lineHeight: 1.55, color: "#4b5563", whiteSpace: "pre-wrap" }}>{quote.notes}</div>
                </div>
              ) : null}
              {quote.terms ? (
                <div style={{ background: "#e7e7e8", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: px(12, 13), letterSpacing: 0.6, fontWeight: 800, color: "#8b8e95", marginBottom: 5 }}>VOORWAARDEN</div>
                  <div style={{ fontSize: px(13, 14), lineHeight: 1.55, color: "#4b5563", whiteSpace: "pre-wrap" }}>{quote.terms}</div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="avoid-break" style={{ padding: "0 36px 26px 36px" }}>
          <div style={{ borderRadius: 10, background: "#e5e5e6", overflow: "hidden" }}>
            <div style={{ borderLeft: `9px solid ${company.primaryColor}`, padding: "12px 16px" }}>
                  <div style={{ fontSize: px(20, 22), fontWeight: 800, color: "#111" }}>{company.signatureName}</div>
                  <div style={{ fontSize: px(14, 15), color: "#4b5563" }}>
                    {company.signatureTitle} · Creative Director · {company.name}
                  </div>
            </div>
          </div>
        </section>

        <section style={{ background: "#0a0d12", padding: "16px 36px", borderLeft: `12px solid ${company.primaryColor}` }}>
          <div style={{ textAlign: "center", fontSize: px(13, 14), color: "#80858d", lineHeight: 1.6 }}>
            {company.email || "contact@digitify.be"} · {company.phone || "+32 (0) 486 51 57 73"} · {company.website || "www.digitify.be"} · BTW: {company.vat || "-"}
          </div>
        </section>
      </div>
    </>
  );
}
