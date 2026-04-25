"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import { FileText, Plus, Trash2, Calendar, User } from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

  const reportsQuery = trpc.report.list.useQuery({ page, perPage: 12 });
  const campaignsQuery = trpc.campaign.list.useQuery();
  const generateMutation = trpc.report.generate.useMutation({
    onSuccess: (report) => {
      setDialogOpen(false);
      reportsQuery.refetch();
      router.push(`/reports/${report.id}`);
    },
  });
  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      reportsQuery.refetch();
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      campaignId: selectedCampaignId === "all" ? undefined : selectedCampaignId,
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Weet je zeker dat je dit rapport wilt verwijderen?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Rapporten</h1>
          <p className="text-sm text-muted-foreground">
            Genereer en bekijk rapporten over je leads
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Rapport Genereren
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nieuw Rapport Genereren</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Selecteer campagne</label>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kies een campagne..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Leads</SelectItem>
                    {campaignsQuery.data?.map((campaign: NonNullable<typeof campaignsQuery.data>[number]) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? "Bezig met genereren..." : "Genereren"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {reportsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : reportsQuery.data?.reports.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Nog geen rapporten gegenereerd
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Klik op &quot;Rapport Genereren&quot; om te beginnen
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reportsQuery.data?.reports.map((report: NonNullable<typeof reportsQuery.data>["reports"][number]) => {
              const data = report.data as Record<string, unknown>;
              return (
                <Card
                  key={report.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
                  onClick={() => router.push(`/reports/${report.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base leading-tight">{report.title}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(report.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={report.type === "campaign" ? "default" : "secondary"}>
                        {report.type === "campaign" ? "Campagne" : "Alle Leads"}
                      </Badge>
                      {report.campaign && (
                        <Badge variant="outline">{report.campaign.name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(report.createdAt).toLocaleDateString("nl-BE")}
                      </span>
                      {report.generatedBy?.name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {report.generatedBy.name}
                        </span>
                      )}
                    </div>
                    {data?.totalLeads != null && (
                      <p className="text-xs text-muted-foreground">
                        {String(data.totalLeads)} leads | Score gem.{" "}
                        {String(data.avgScore ?? "-")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {reportsQuery.data && reportsQuery.data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Vorige
              </Button>
              <span className="text-sm text-muted-foreground">
                Pagina {page} van {reportsQuery.data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === reportsQuery.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Volgende
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
