export type LeadPdfRow = {
  companyName: string;
  city?: string | null;
  country?: string | null;
  industry?: string | null;
  scorePriority?: string | null;
  overallScore?: number | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  createdAt: string | Date;
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("nl-BE");
}

export function buildLeadsPdfHtml(params: {
  title: string;
  generatedAt: Date;
  leads: LeadPdfRow[];
}) {
  const rows = params.leads
    .map(
      (lead) => `
      <tr>
        <td>${esc(lead.companyName)}</td>
        <td>${esc([lead.city, lead.country].filter(Boolean).join(", ") || "-")}</td>
        <td>${esc(lead.industry || "-")}</td>
        <td>${lead.overallScore == null ? "-" : lead.overallScore.toFixed(1)}</td>
        <td>${esc(lead.scorePriority || "-")}</td>
        <td>${esc(lead.email || lead.phone || "-")}</td>
        <td>${esc(lead.website || "-")}</td>
        <td>${esc(formatDate(lead.createdAt))}</td>
      </tr>
    `,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }
    .page { padding: 24px; }
    h1 { margin: 0; font-size: 22px; }
    .meta { margin-top: 6px; color: #475569; font-size: 12px; }
    .card { margin-top: 16px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 10px 8px; background: #0f172a; color: #fff; font-weight: 600; }
    td { padding: 8px; border-top: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="page">
    <h1>${esc(params.title)}</h1>
    <p class="meta">Aangemaakt op ${esc(params.generatedAt.toLocaleString("nl-BE"))} · ${params.leads.length} leads</p>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Bedrijf</th>
            <th>Locatie</th>
            <th>Niche</th>
            <th>Score</th>
            <th>Prioriteit</th>
            <th>Contact</th>
            <th>Website</th>
            <th>Aangemaakt</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}
