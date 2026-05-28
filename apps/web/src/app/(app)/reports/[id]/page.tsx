"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button, Skeleton } from "@digitify/ui";
import { ArrowLeft, Download } from "lucide-react";
import {
  WebsiteAuditDetail,
  type WebsiteAuditPayload,
} from "@/components/reports/website-audit-detail";
import { LeadCampaignReportDetail } from "@/components/reports/lead-campaign-report-detail";

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const reportQuery = trpc.report.getById.useQuery({ id: reportId });
  const report = reportQuery.data ?? null;

  const handleExportPdf = () => {
    window.open(`/reports/${reportId}/print`, "_blank");
  };

  if (reportQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (reportQuery.error || !report) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Rapport niet gevonden</p>
        <Button variant="outline" onClick={() => router.push("/reports")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug
        </Button>
      </div>
    );
  }

  const isWebsiteAudit = report.type === "website_audit";

  return (
    <div className="print-report space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.push("/reports")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/reports")}>
            Terug naar overzicht
          </Button>
          {!isWebsiteAudit ? (
            <Button onClick={handleExportPdf}>
              <Download className="mr-2 h-4 w-4" />
              Exporteer PDF
            </Button>
          ) : null}
        </div>
      </div>

      {isWebsiteAudit ? (
        <WebsiteAuditDetail
          payload={(report.data ?? {}) as WebsiteAuditPayload}
          title={report.title}
          createdAt={
            typeof report.createdAt === "string"
              ? report.createdAt
              : report.createdAt.toISOString()
          }
          leadId={report.leadId}
        />
      ) : (
        <LeadCampaignReportDetail report={report} onExportPdf={handleExportPdf} />
      )}
    </div>
  );
}
