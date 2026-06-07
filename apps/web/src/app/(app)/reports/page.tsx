"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Card,
  CardContent,
  CreateModal,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@digitify/ui";
import { Globe, Loader2, ScanSearch, Sparkles } from "lucide-react";
import {
  WebsiteAuditReportCard,
  type WebsiteAuditReportCardProps,
} from "@/components/reports/website-audit-report-card";

export default function ReportsPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [leadId, setLeadId] = useState("__none");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const audits = trpc.audit.listRecent.useQuery({ limit: 24 });
  const leads = trpc.lead.options.useQuery(
    { limit: 30 },
    { staleTime: 120_000 },
  );
  const runAudit = trpc.audit.run.useMutation({
    onSuccess: (data) => {
      audits.refetch();
      router.push(`/reports/${data.reportId}`);
    },
  });
  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      audits.refetch();
      setDeleteId(null);
    },
  });

  const pending = runAudit.isPending;

  return (
    <div className="app-page reports-auditor-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Website auditor</h1>
          <p className="app-page-subtitle">
            Laat een bot je website scannen — pagina&apos;s, knoppen, snelheid en SEO — en ontvang een
            verbeterrapport voor elk bedrijf.
          </p>
        </div>
      </div>

      <Card className="reports-auditor-hero app-surface">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="audit-url" className="text-sm font-medium">
                Website URL
              </Label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="audit-url"
                  className="pl-9"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://jouwbedrijf.be"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && url.trim() && !pending) {
                      runAudit.mutate({
                        url: url.trim(),
                        leadId: leadId === "__none" ? undefined : leadId,
                      });
                    }
                  }}
                />
              </div>
              {runAudit.error ? (
                <p className="text-sm text-destructive">{runAudit.error.message}</p>
              ) : null}
            </div>
            <div className="w-full space-y-2 lg:max-w-xs">
              <Label className="text-sm font-medium">Koppel aan lead (optioneel)</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Geen lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Geen lead</SelectItem>
                  {(leads.data ?? []).map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="lg"
              className="shrink-0"
              disabled={!url.trim() || pending}
              onClick={() =>
                runAudit.mutate({
                  url: url.trim(),
                  leadId: leadId === "__none" ? undefined : leadId,
                })
              }
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="mr-2 h-4 w-4" />
              )}
              {pending ? "Website scannen…" : "Audit starten"}
            </Button>
          </div>
          {pending ? (
            <p className="mt-3 text-xs text-muted-foreground">
              We controleren de homepage, interne pagina&apos;s, knoppen, formulieren, SEO en
              contactsignalen. Dit kan tot een minuut duren.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="reports" className="space-y-3">
        <TabsList className="page-view-tabs">
          <TabsTrigger value="reports" className="page-view-tabs-trigger">
            Rapporten
          </TabsTrigger>
          <TabsTrigger value="info" className="page-view-tabs-trigger">
            Hoe het werkt
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-3">
          {audits.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[7.25rem] w-full rounded-2xl" />
              ))}
            </div>
          ) : (audits.data ?? []).length === 0 ? (
            <Card className="app-surface">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Sparkles />}
                  title="Nog geen website-audits"
                  description="Voer een URL in om je eerste verbeterrapport te genereren."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(audits.data ?? []).map((item) => {
                const data = (item.data ?? {}) as WebsiteAuditReportCardProps["data"];
                return (
                  <WebsiteAuditReportCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    createdAt={item.createdAt}
                    data={data}
                    onOpen={() => router.push(`/reports/${item.id}`)}
                    onDelete={() => setDeleteId(item.id)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="reports-auditor-info-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stap 1</p>
                <p className="mt-2 text-sm font-medium">Voer de website-URL in van elk bedrijf — horeca, retail, B2B, …</p>
              </CardContent>
            </Card>
            <Card className="reports-auditor-info-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stap 2</p>
                <p className="mt-2 text-sm font-medium">
                  De bot scant pagina&apos;s, knoppen, formulieren, laadtijd, SEO, reviews en contact.
                </p>
              </CardContent>
            </Card>
            <Card className="reports-auditor-info-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stap 3</p>
                <p className="mt-2 text-sm font-medium">
                  Gebruik het rapport in salesgesprekken of interne optimalisatie — met concrete acties.
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="app-surface">
            <CardContent className="flex flex-wrap gap-2 p-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/leads">Leads</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/settings">API-instellingen (Google Places)</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateModal
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Audit verwijderen"
        description="Weet je zeker dat je dit auditrapport wilt verwijderen?"
        submitLabel="Verwijderen"
        submitVariant="destructive"
        pending={deleteMutation.isPending}
        onSubmit={() => {
          if (deleteId) deleteMutation.mutate({ id: deleteId });
        }}
      >
        <p className="text-sm text-muted-foreground">Verwijderde rapporten zijn niet meer terug te halen.</p>
      </CreateModal>
    </div>
  );
}
