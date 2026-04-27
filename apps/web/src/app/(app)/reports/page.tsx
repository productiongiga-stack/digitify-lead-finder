"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  CreateModal,
  EmptyState,
  Label,
} from "@digitify/ui";
import { FileText, Plus, Trash2, Calendar, User } from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");

  const reportsQuery = trpc.report.list.useQuery({ page, perPage: 12 });
  const campaignsQuery = trpc.campaign.list.useQuery();
  const generateMutation = trpc.report.generate.useMutation({
    onSuccess: (report) => {
      setGenerateOpen(false);
      reportsQuery.refetch();
      router.push(`/reports/${report.id}`);
    },
  });
  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      reportsQuery.refetch();
      setDeleteId(null);
    },
  });

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Rapporten</h1>
          <p className="app-page-subtitle">Genereer en bekijk rapporten over je leads</p>
        </div>
        <Button size="sm" onClick={() => setGenerateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Rapport Genereren
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          {reportsQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-lg" />
              ))}
            </div>
          ) : reportsQuery.data?.reports.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<FileText />}
                  title="Nog geen rapporten gegenereerd"
                  description='Klik op "Rapport Genereren" om te beginnen.'
                  action={
                    <Button size="sm" onClick={() => setGenerateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Rapport Genereren
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {reportsQuery.data?.reports.map(
                  (report: NonNullable<typeof reportsQuery.data>["reports"][number]) => {
                    const data = report.data as Record<string, unknown>;
                    return (
                      <Card
                        key={report.id}
                        className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
                        onClick={() => router.push(`/reports/${report.id}`)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-sm leading-tight">
                              {report.title}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(report.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={report.type === "campaign" ? "default" : "secondary"}>
                              {report.type === "campaign" ? "Campagne" : "Alle Leads"}
                            </Badge>
                            {report.campaign ? (
                              <Badge variant="outline">{report.campaign.name}</Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(report.createdAt).toLocaleDateString("nl-BE")}
                            </span>
                            {report.generatedBy?.name ? (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {report.generatedBy.name}
                              </span>
                            ) : null}
                          </div>
                          {data?.totalLeads != null ? (
                            <p className="text-xs text-muted-foreground">
                              {String(data.totalLeads)} leads · score gem.{" "}
                              {String(data.avgScore ?? "—")}
                            </p>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  },
                )}
              </div>

              {reportsQuery.data && reportsQuery.data.totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Vorige
                  </Button>
                  <span className="text-xs text-muted-foreground">
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
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gebruik
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  Genereer rapporten per campagne om snel trends in leadkwaliteit, score en
                  output te zien.
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Voor wie
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  Handig voor sales en operations om wekelijkse opvolging en
                  campagnebeslissingen te onderbouwen.
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gerelateerd
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/campaigns">Campagnes</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/leads">Leads</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Generate dialog */}
      <CreateModal
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="Nieuw Rapport Genereren"
        description="Selecteer een campagne om over te rapporteren, of kies alle leads."
        submitLabel="Genereren"
        pending={generateMutation.isPending}
        onSubmit={() =>
          generateMutation.mutate({
            campaignId: selectedCampaignId === "all" ? undefined : selectedCampaignId,
          })
        }
      >
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selecteer campagne</Label>
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger>
              <SelectValue placeholder="Kies een campagne..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Leads</SelectItem>
              {campaignsQuery.data?.map(
                (campaign: NonNullable<typeof campaignsQuery.data>[number]) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </CreateModal>

      {/* Delete confirmation */}
      <CreateModal
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Rapport verwijderen"
        description="Weet je zeker dat je dit rapport wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
        submitLabel="Verwijderen"
        submitVariant="destructive"
        pending={deleteMutation.isPending}
        onSubmit={() => deleteId && deleteMutation.mutate({ id: deleteId })}
      >
        <p className="text-sm text-muted-foreground">
          Verwijderde rapporten zijn niet meer terug te halen.
        </p>
      </CreateModal>
    </div>
  );
}
