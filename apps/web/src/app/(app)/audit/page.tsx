"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@digitify/ui";
import { ScanSearch, Sparkles } from "lucide-react";

export default function AuditPage() {
  const [url, setUrl] = useState("");
  const [leadId, setLeadId] = useState("__none");
  const [result, setResult] = useState<any>(null);
  const leads = trpc.lead.list.useQuery({ page: 1, pageSize: 200, sortBy: "companyName", sortDir: "asc" });
  const audits = trpc.audit.listRecent.useQuery({ limit: 16 });
  const runAudit = trpc.audit.run.useMutation({
    onSuccess: (data) => {
      setResult(data);
      audits.refetch();
    },
  });

  return (
    <div className="app-page space-y-4">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Website Audit</h1>
          <p className="app-page-subtitle">Analyseer snelheid, SEO, social presence, Google reviews en contactsignalen.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nieuwe audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_260px_auto]">
            <div className="space-y-1.5">
              <Label>Website URL</Label>
              <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://voorbeeld.be" />
            </div>
            <div className="space-y-1.5">
              <Label>Lead (optioneel)</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Geen lead</SelectItem>
                  {(leads.data?.items || []).map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>{lead.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                disabled={!url.trim() || runAudit.isPending}
                onClick={() => runAudit.mutate({ url: url.trim(), leadId: leadId === "__none" ? undefined : leadId })}
              >
                <ScanSearch className="mr-2 h-4 w-4" />
                Audit draaien
              </Button>
            </div>
          </div>
          {runAudit.error ? (
            <p className="text-sm text-destructive">{runAudit.error.message}</p>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Audit resultaat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Overall {result.metrics.overall}</Badge>
              <Badge variant="outline">Speed {result.metrics.speedScore}</Badge>
              <Badge variant="outline">SEO {result.metrics.seoScore}</Badge>
              <Badge variant="outline">Social {result.metrics.socialScore}</Badge>
              <Badge variant="outline">Reviews {result.metrics.reviewScore}</Badge>
              <Badge variant="outline">Contact {result.metrics.contactScore}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Checks</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status {result.checks.statusCode} · SSL {result.checks.ssl ? "ja" : "nee"} ·
                  Mobiel {result.checks.mobileFriendly ? "ja" : "nee"} ·
                  Laadtijd {result.checks.loadTimeMs} ms
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Google reviews</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rating {result.checks.reviews.rating ?? "-"} ·
                  Aantal {result.checks.reviews.reviewCount ?? "-"} ·
                  Bron {result.checks.reviews.source}
                </p>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Verbetersuggesties</p>
              <Textarea
                readOnly
                value={(result.suggestions || []).map((item: string) => `• ${item}`).join("\n")}
                rows={Math.max(4, (result.suggestions || []).length + 1)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recente audits</CardTitle>
        </CardHeader>
        <CardContent>
          {(audits.data || []).length === 0 ? (
            <EmptyState icon={<Sparkles />} title="Nog geen audits" description="Voer je eerste audit uit om een rapport te krijgen." />
          ) : (
            <div className="grid gap-2">
              {(audits.data || []).map((item) => {
                const metrics = (item.data as any)?.metrics as Record<string, number> | undefined;
                return (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("nl-BE")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {metrics?.overall != null ? <Badge variant="outline">Overall {metrics.overall}</Badge> : null}
                        {item.leadId ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/leads/${item.leadId}`}>Open lead</Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
