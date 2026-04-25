"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

type AggregateReportData = {
  totalLeads: number;
  avgScore: number;
  hotCount: number;
  warmCount: number;
  lowCount: number;
  topNiches: Array<{ name: string; count: number }>;
  topCities: Array<{ name: string; count: number }>;
  pipelineBreakdown: Array<{ name: string; count: number }>;
  campaignName: string;
  generatedAt: string;
};

type LeadProposalData = {
  lead?: {
    leadId?: string;
    companyName?: string;
    website?: string;
    city?: string;
    industry?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  score?: {
    overall?: number;
    priority?: string;
  };
  audit?: {
    ssl?: boolean;
    mobileFriendly?: boolean;
    responseTime?: number;
    hasCTA?: boolean;
    hasAnalytics?: boolean;
    technologies?: string[];
    seo?: {
      hasMetaTitle?: boolean;
      hasMetaDescription?: boolean;
      hasH1?: boolean;
      hasStructuredData?: boolean;
    };
  };
  painPoints?: string[];
  suggestedServices?: string[];
  opportunityAreas?: Array<{
    factor?: string;
    impactScore?: number;
    urgency?: string;
    explanation?: string;
    recommendation?: string;
  }>;
  quickWins?: string[];
  executiveSummary?: string[];
  communication?: {
    sentEmails?: number;
    repliedEmails?: number;
    conversionRate?: number;
    lastActivityAt?: string;
  };
  context?: {
    pipelineStage?: string;
    tags?: string[];
  };
  tags?: string[];
  generatedAt?: string;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPercent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, background: "#fff" }}>
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{label}</p>
      <p style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{value}</p>
    </div>
  );
}

export default function ReportPrintPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [ready, setReady] = useState(false);

  const { data: report } = trpc.report.getById.useQuery({ id: reportId });
  const { data: brandingSettings } = trpc.settings.getAll.useQuery(undefined, {
    staleTime: 60_000,
  });

  const branding = {
    companyName: String(brandingSettings?.["branding.company_name"] || brandingSettings?.["company.name"] || "Digitify"),
    logoUrl: String(brandingSettings?.["branding.logo_url"] || ""),
    primaryColor: String(brandingSettings?.["branding.primary_color"] || "#6366f1"),
    website: String(brandingSettings?.["company.website"] || brandingSettings?.["branding.website"] || ""),
    email: String(brandingSettings?.["company.email"] || brandingSettings?.["branding.email"] || ""),
    phone: String(brandingSettings?.["company.phone"] || brandingSettings?.["branding.phone"] || ""),
  };

  useEffect(() => {
    if (report && brandingSettings) {
      setReady(true);
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [report, brandingSettings]);

  const isLeadProposal = useMemo(() => {
    const data = report?.data as Record<string, unknown> | undefined;
    return report?.type === "lead_proposal" || Boolean(data && "lead" in data);
  }, [report]);

  if (!ready || !report) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#6366f1", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <p style={{ margin: 0, color: "#64748b" }}>Rapport laden...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const data = report.data as AggregateReportData & LeadProposalData;

  return (
    <>
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          @page { margin: 14mm 12mm; size: A4; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #e2e8f0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 16, right: 16, display: "flex", gap: 8, zIndex: 50 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "10px 18px", borderRadius: 999, border: "none", color: "#fff", background: branding.primaryColor, fontWeight: 700, cursor: "pointer" }}
        >
          PDF exporteren
        </button>
        <button
          onClick={() => window.history.back()}
          style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          Terug
        </button>
      </div>

      <div
        style={{
          maxWidth: 794,
          margin: "24px auto",
          background: "#fff",
          color: "#0f172a",
          boxShadow: "0 20px 80px rgba(15,23,42,0.12)",
          fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
        }}
      >
        <div style={{ padding: "40px 40px 32px", background: `linear-gradient(135deg, ${branding.primaryColor} 0%, #0f172a 100%)`, color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.companyName} style={{ width: 54, height: 54, borderRadius: 16, objectFit: "contain", background: "#fff", padding: 6 }} />
              ) : (
                <div style={{ width: 54, height: 54, borderRadius: 16, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22 }}>
                  {branding.companyName.charAt(0)}
                </div>
              )}
              <div>
                <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
                  Gepersonaliseerd voorstel
                </p>
                <h1 style={{ margin: "6px 0 0", fontSize: 30, lineHeight: 1.1, fontWeight: 800 }}>{report.title}</h1>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.76)" }}>
              <p style={{ margin: 0 }}>App: Digitify Lead Finder</p>
              <p style={{ margin: 0 }}>Door {report.generatedBy?.name || branding.companyName}</p>
              <p style={{ margin: "6px 0 0" }}>Datum {formatDate(report.createdAt)}</p>
              {branding.website ? <p style={{ margin: "6px 0 0" }}>{branding.website}</p> : null}
            </div>
          </div>
        </div>

        {isLeadProposal ? (
          <LeadProposalReport branding={branding} data={data} />
        ) : (
          <AggregateOpportunityReport branding={branding} data={data as AggregateReportData} />
        )}
      </div>
    </>
  );
}

function LeadProposalReport({
  branding,
  data,
}: {
  branding: { companyName: string; primaryColor: string; website: string; email: string; phone: string };
  data: LeadProposalData;
}) {
  const lead = data.lead || {};
  const audit = data.audit;
  const score = data.score?.overall || 0;
  const priority = data.score?.priority || "Warm";
  const painPoints = data.painPoints || [];
  const services = data.suggestedServices || [];
  const opportunities = data.opportunityAreas || [];
  const quickWins = data.quickWins || [];
  const executiveSummary = data.executiveSummary || [];
  const communication = data.communication || {};
  const contextTags = data.context?.tags || data.tags || [];

  const auditSignals = [
    { label: "SSL", ok: audit?.ssl },
    { label: "Mobiel", ok: audit?.mobileFriendly },
    { label: "CTA", ok: audit?.hasCTA },
    { label: "Analytics", ok: audit?.hasAnalytics },
    { label: "Meta titel", ok: audit?.seo?.hasMetaTitle },
    { label: "Meta beschrijving", ok: audit?.seo?.hasMetaDescription },
  ];

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, background: "#f8fafc" }}>
          <SectionTitle color={branding.primaryColor}>Klantprofiel</SectionTitle>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{lead.companyName || "Lead"}</h2>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14, color: "#475569" }}>
            <div>{lead.website || "Geen website opgegeven"}</div>
            <div>{lead.city || "Locatie onbekend"}</div>
            <div>{lead.industry || "Sector onbekend"}</div>
            <div>{lead.email || lead.phone || "Geen contactdetail beschikbaar"}</div>
          </div>
          <p style={{ margin: "18px 0 0", fontSize: 15, lineHeight: 1.8, color: "#334155" }}>
            Dit document vat de digitale sterktes en hiaten samen en vertaalt die meteen naar een concreet traject waarmee {branding.companyName} kan helpen.
          </p>
        </div>

        <div style={{ borderRadius: 24, padding: 24, background: "#0f172a", color: "#fff" }}>
          <SectionTitle color="#93c5fd">Opportunity Score</SectionTitle>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 56, fontWeight: 800 }}>{score}</span>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.72)" }}>/100</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "rgba(255,255,255,0.74)" }}>Prioriteit: {priority}</p>
          {audit?.responseTime ? (
            <p style={{ margin: "14px 0 0", fontSize: 14, color: "rgba(255,255,255,0.74)" }}>
              Gemeten laadtijd: {audit.responseTime} ms
            </p>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 28, border: "1px solid #e2e8f0", borderRadius: 24, padding: 24 }}>
        <SectionTitle color={branding.primaryColor}>Website Check</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {auditSignals.map((signal) => (
            <div key={signal.label} style={{ borderRadius: 18, padding: 16, background: signal.ok ? "#ecfdf5" : "#fff1f2", border: `1px solid ${signal.ok ? "#bbf7d0" : "#fecdd3"}` }}>
              <p style={{ margin: 0, fontSize: 12, color: signal.ok ? "#166534" : "#9f1239" }}>{signal.label}</p>
              <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 700 }}>{signal.ok ? "In orde" : "Werkpunt"}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, background: "#f8fafc" }}>
        <SectionTitle color={branding.primaryColor}>Executive Summary</SectionTitle>
        <div style={{ display: "grid", gap: 10 }}>
          {(executiveSummary.length
            ? executiveSummary
            : [
                `${lead.companyName || "Deze klant"} heeft duidelijke commerciële opportuniteiten in leadgeneratie, opvolging en website-conversie.`,
              ]).map((line) => (
            <p key={line} style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.75 }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: 24 }}>
          <SectionTitle color={branding.primaryColor}>Wat beter kan</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.8 }}>
            {(painPoints.length ? painPoints : ["Er is ruimte voor meer zichtbaarheid, betere conversie en een sterkere digitale opvolging."]).map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, background: "#f8fafc" }}>
          <SectionTitle color={branding.primaryColor}>Hoe wij kunnen helpen</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.8 }}>
            {(services.length ? services : ["Website optimalisatie", "Conversiegerichte opvolging", "Lokale zichtbaarheid en leadgeneratie"]).map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 28, border: "1px solid #e2e8f0", borderRadius: 24, padding: 24 }}>
        <SectionTitle color={branding.primaryColor}>Opportunity Metrics</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Top opportuniteiten</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800 }}>{opportunities.length}</p>
          </div>
          <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Verzonden e-mails</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800 }}>{communication.sentEmails || 0}</p>
          </div>
          <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Reacties</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800 }}>{communication.repliedEmails || 0}</p>
          </div>
          <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Response rate</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800 }}>{communication.conversionRate || 0}%</p>
          </div>
        </div>
        {contextTags.length > 0 ? (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {contextTags.slice(0, 10).map((tag) => (
              <span
                key={tag}
                style={{
                  borderRadius: 999,
                  border: "1px solid #dbeafe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: 24 }}>
          <SectionTitle color={branding.primaryColor}>Top Opportuniteiten</SectionTitle>
          <div style={{ display: "grid", gap: 12 }}>
            {(opportunities.length
              ? opportunities
              : [
                  {
                    factor: "Lead opvolging",
                    impactScore: 0,
                    urgency: "middel",
                    explanation: "Focus op opvolging en conversie.",
                    recommendation: "Werk met een vaste opvolgsequentie.",
                  },
                ]
            )
              .slice(0, 5)
              .map((opportunity, index) => (
                <div key={`${opportunity.factor}-${index}`} style={{ borderRadius: 14, border: "1px solid #e2e8f0", padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {index + 1}. {opportunity.factor}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                    Impact: {opportunity.impactScore ?? 0} · Urgentie: {opportunity.urgency || "normaal"}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                    {opportunity.explanation}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#1e293b", fontWeight: 600, lineHeight: 1.7 }}>
                    Aanpak: {opportunity.recommendation}
                  </p>
                </div>
              ))}
          </div>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, background: "#f8fafc" }}>
          <SectionTitle color={branding.primaryColor}>Quick Wins (30 dagen)</SectionTitle>
          <ol style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.9 }}>
            {(quickWins.length
              ? quickWins
              : [
                  "Verhoog de zichtbaarheid op lokale zoekopdrachten.",
                  "Optimaliseer CTA's op de belangrijkste pagina's.",
                  "Versterk opvolging via e-mail met een vaste cadans.",
                ]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </div>

      <div style={{ marginTop: 28, borderRadius: 28, padding: 28, background: `linear-gradient(135deg, ${branding.primaryColor} 0%, #1e293b 100%)`, color: "#fff" }}>
        <SectionTitle color="rgba(255,255,255,0.75)">Volgende stap</SectionTitle>
        <h3 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Laat ons dit omzetten in een concreet actieplan</h3>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.8, color: "rgba(255,255,255,0.84)" }}>
          {branding.companyName} kan dit traject vertalen naar een heldere offerte, duidelijke timing en meetbaar resultaat voor {lead.companyName || "uw bedrijf"}.
        </p>
        <p style={{ margin: "18px 0 0", fontSize: 14 }}>
          {branding.email || branding.website || branding.phone}
        </p>
      </div>
    </div>
  );
}

function AggregateOpportunityReport({
  branding,
  data,
}: {
  branding: { companyName: string; primaryColor: string; website: string; email: string; phone: string };
  data: AggregateReportData;
}) {
  const topNiche = data.topNiches[0];
  const topCity = data.topCities[0];
  const topStage = data.pipelineBreakdown[0];

  const insights = [
    topNiche ? `${topNiche.name} is vandaag de meest interessante branche in deze dataset, goed voor ${topNiche.count} opportuniteiten.` : null,
    topCity ? `${topCity.name} is de sterkste regio in deze analyse en verdient prioriteit in prospectie en opvolging.` : null,
    `${formatPercent(data.hotCount, data.totalLeads)} van de leads zit meteen in de hoogste prioriteit.`,
    topStage ? `De grootste cluster zit momenteel in "${topStage.name}", wat duidelijk maakt waar het verkoopproces het meeste rendement kan halen.` : null,
  ].filter(Boolean) as string[];

  const actionPlan = [
    "Concentreer commerciële opvolging eerst op hot leads en niches met hoge dichtheid.",
    "Gebruik een overtuigende audit of offerte per niche zodat prospecten sneller begrijpen waar winst te halen valt.",
    "Koppel rapportage, outreach en opvolging strakker zodat warme leads niet stilvallen in de pipeline.",
  ];

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <StatCard label="Leads" value={data.totalLeads} />
        <StatCard label="Gemiddelde score" value={data.avgScore} />
        <StatCard label="Hot leads" value={data.hotCount} />
        <StatCard label="Warm leads" value={data.warmCount} />
      </div>

      <div style={{ marginTop: 28, border: "1px solid #e2e8f0", borderRadius: 24, padding: 24 }}>
        <SectionTitle color={branding.primaryColor}>Executive Summary</SectionTitle>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.8, color: "#334155" }}>
          Dit rapport is geen ruwe export, maar een commerciële momentopname. Het toont waar de meeste tractie zit,
          welke segmenten het snelst kunnen converteren en waar {branding.companyName} met een gerichte aanpak het grootste verschil kan maken.
        </p>
        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          {insights.map((insight) => (
            <div key={insight} style={{ borderRadius: 18, border: "1px solid #e2e8f0", padding: 16, background: "#f8fafc", color: "#334155", fontSize: 14, lineHeight: 1.7 }}>
              {insight}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: 24 }}>
          <SectionTitle color={branding.primaryColor}>Sterkste segmenten</SectionTitle>
          <div style={{ display: "grid", gap: 12 }}>
            {data.topNiches.slice(0, 4).map((item) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 14, color: "#334155" }}>{item.name}</span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 700 }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, background: "#f8fafc" }}>
          <SectionTitle color={branding.primaryColor}>Actieplan</SectionTitle>
          <ol style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.9 }}>
            {actionPlan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      </div>

      <div style={{ marginTop: 28, borderRadius: 28, padding: 28, background: `linear-gradient(135deg, ${branding.primaryColor} 0%, #0f172a 100%)`, color: "#fff" }}>
        <SectionTitle color="rgba(255,255,255,0.75)">Hoe wij kunnen helpen</SectionTitle>
        <h3 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Van inzichten naar pipeline-groei</h3>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.8, color: "rgba(255,255,255,0.84)" }}>
          Op basis van deze analyse kan {branding.companyName} de juiste branches prioriteren, betere prospectvoorstellen bouwen
          en opvolging automatiseren zodat meer warme leads effectief converteren.
        </p>
        <p style={{ margin: "18px 0 0", fontSize: 14 }}>
          {branding.email || branding.website || branding.phone}
        </p>
      </div>
    </div>
  );
}
