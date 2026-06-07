"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { readSettingBoolean, readSettingString } from "@/lib/settings";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";
import { useToast } from "@/components/feedback/toast-provider";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@digitify/ui";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  Globe2,
  Loader2,
  Save,
  Shield,
  Trash2,
  Users,
} from "lucide-react";

export default function AnalyticsSettingsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const { data: settings, isLoading } = trpc.settings.getAnalyticsSettings.useQuery(
    undefined,
    SETTINGS_PAGE_QUERY_OPTS,
  );
  const summaryQuery = trpc.analytics.getSummary.useQuery({ days: 7 }, { retry: 1 });

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAnalyticsSettings.invalidate();
      utils.analytics.getSummary.invalidate();
      showToast({ title: "Analytics opgeslagen", description: "Trackers en privacy-instellingen zijn bijgewerkt." });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const purgeMutation = trpc.analytics.purgeOldEvents.useMutation({
    onSuccess: (result) => {
      utils.analytics.getSummary.invalidate();
      showToast({
        title: "Oude events verwijderd",
        description: `${result.deleted} records ouder dan retentieperiode gewist.`,
      });
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [trackApp, setTrackApp] = useState(true);
  const [trackWidgets, setTrackWidgets] = useState(true);
  const [anonymizeIp, setAnonymizeIp] = useState(true);
  const [respectDnt, setRespectDnt] = useState(true);
  const [ga4Id, setGa4Id] = useState("");
  const [gtmId, setGtmId] = useState("");
  const [plausibleDomain, setPlausibleDomain] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [linkedinPartnerId, setLinkedinPartnerId] = useState("");
  const [customScript, setCustomScript] = useState("");
  const [retentionDays, setRetentionDays] = useState("90");

  useEffect(() => {
    if (!settings) return;
    setEnabled(readSettingBoolean(settings, "analytics.enabled", false));
    setTrackApp(readSettingBoolean(settings, "analytics.track_app_usage", true));
    setTrackWidgets(readSettingBoolean(settings, "analytics.track_widget_views", true));
    setAnonymizeIp(readSettingBoolean(settings, "analytics.anonymize_ip", true));
    setRespectDnt(readSettingBoolean(settings, "analytics.respect_dnt", true));
    setGa4Id(readSettingString(settings, "analytics.ga4_measurement_id"));
    setGtmId(readSettingString(settings, "analytics.gtm_container_id"));
    setPlausibleDomain(readSettingString(settings, "analytics.plausible_domain"));
    setMetaPixelId(readSettingString(settings, "analytics.meta_pixel_id"));
    setLinkedinPartnerId(readSettingString(settings, "analytics.linkedin_partner_id"));
    setCustomScript(readSettingString(settings, "analytics.custom_head_script"));
    setRetentionDays(readSettingString(settings, "analytics.retention_days", "90"));
  }, [settings]);

  function handleSave() {
    batchUpdate.mutate([
      { key: "analytics.enabled", value: String(enabled) },
      { key: "analytics.track_app_usage", value: String(trackApp) },
      { key: "analytics.track_widget_views", value: String(trackWidgets) },
      { key: "analytics.anonymize_ip", value: String(anonymizeIp) },
      { key: "analytics.respect_dnt", value: String(respectDnt) },
      { key: "analytics.ga4_measurement_id", value: ga4Id.trim() },
      { key: "analytics.gtm_container_id", value: gtmId.trim() },
      { key: "analytics.plausible_domain", value: plausibleDomain.trim() },
      { key: "analytics.meta_pixel_id", value: metaPixelId.trim() },
      { key: "analytics.linkedin_partner_id", value: linkedinPartnerId.trim() },
      { key: "analytics.custom_head_script", value: customScript.trim() },
      { key: "analytics.retention_days", value: retentionDays.trim() || "90" },
    ]);
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="mt-0.5">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Analytics & tracking</h1>
            <p className="text-sm text-muted-foreground">
              Website trackers, productgebruik en widget-bezoeken. Alleen zichtbaar voor workspace owners.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "success" : "secondary"}>{enabled ? "Actief" : "Uit"}</Badge>
          <Button onClick={handleSave} disabled={batchUpdate.isPending}>
            {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Opslaan
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paginaweergaven (7d)</CardDescription>
            <CardTitle className="text-2xl">{summary?.totals.pageViews ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Widget-weergaven (7d)</CardDescription>
            <CardTitle className="text-2xl">{summary?.totals.widgetViews ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unieke bezoekers/sessies</CardDescription>
            <CardTitle className="text-2xl">{summary?.totals.uniqueVisitors ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teamacties (activity log)</CardDescription>
            <CardTitle className="text-2xl">{summary?.totals.teamActions ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="trackers" className="space-y-4">
        <TabsList className="settings-domain-tabs settings-domain-tabs-cols-3 w-full">
          <TabsTrigger value="trackers" className="settings-domain-tab">
            <Globe2 className="settings-domain-tab-icon" />
            Website trackers
          </TabsTrigger>
          <TabsTrigger value="product" className="settings-domain-tab">
            <Eye className="settings-domain-tab-icon" />
            Product & privacy
          </TabsTrigger>
          <TabsTrigger value="usage" className="settings-domain-tab">
            <Users className="settings-domain-tab-icon" />
            Gebruik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trackers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Externe trackers</CardTitle>
              <CardDescription>
                Scripts worden veilig in de site-header geladen wanneer analytics aan staat. GTM heeft voorrang op GA4.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Google Tag Manager container ID</Label>
                <Input value={gtmId} onChange={(e) => setGtmId(e.target.value)} placeholder="GTM-XXXXXXX" className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>GA4 measurement ID</Label>
                <Input value={ga4Id} onChange={(e) => setGa4Id(e.target.value)} placeholder="G-XXXXXXXX" className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Plausible domein</Label>
                <Input value={plausibleDomain} onChange={(e) => setPlausibleDomain(e.target.value)} placeholder="digitify.be" />
              </div>
              <div className="space-y-2">
                <Label>Meta Pixel ID</Label>
                <Input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="1234567890" className="font-mono text-sm" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>LinkedIn partner ID</Label>
                <Input value={linkedinPartnerId} onChange={(e) => setLinkedinPartnerId(e.target.value)} placeholder="1234567" className="font-mono text-sm" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Aangepast head-script (optioneel)</Label>
                <Textarea
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder="<!-- alleen vertrouwde scripts -->"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Interne product-analytics
              </CardTitle>
              <CardDescription>
                Meet hoe je team de app gebruikt en hoeveel bezoekers je widgets zien — zonder externe dienst.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Analytics ingeschakeld</p>
                  <p className="text-xs text-muted-foreground">Master switch voor trackers én interne events.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">App-gebruik meten</p>
                  <p className="text-xs text-muted-foreground">Paginaweergaven van ingelogde teamleden.</p>
                </div>
                <Switch checked={trackApp} onCheckedChange={setTrackApp} disabled={!enabled} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Widget-bezoeken meten</p>
                  <p className="text-xs text-muted-foreground">Boekings-, review- en offerte-embeds.</p>
                </div>
                <Switch checked={trackWidgets} onCheckedChange={setTrackWidgets} disabled={!enabled} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">IP-adressen anonimiseren</p>
                  <p className="text-xs text-muted-foreground">Aanbevolen voor GDPR-conformiteit.</p>
                </div>
                <Switch checked={anonymizeIp} onCheckedChange={setAnonymizeIp} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Do Not Track respecteren</p>
                  <p className="text-xs text-muted-foreground">Sla tracking over wanneer de browser DNT aangeeft.</p>
                </div>
                <Switch checked={respectDnt} onCheckedChange={setRespectDnt} />
              </div>
              <div className="space-y-2">
                <Label>Dataretentie (dagen)</Label>
                <Input value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} className="max-w-[120px]" />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={purgeMutation.isPending}
                  onClick={() => purgeMutation.mutate({})}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Oude events opschonen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Meest bezochte pagina&apos;s
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-24" />
                ) : summary?.topPaths.length ? (
                  summary.topPaths.map((row) => (
                    <div key={row.path} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="truncate font-mono text-xs">{row.path}</span>
                      <Badge variant="secondary">{row.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nog geen paginaweergaven geregistreerd.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Actiefste teamleden
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summaryQuery.isLoading ? (
                  <Skeleton className="h-24" />
                ) : summary?.topUsers.length ? (
                  summary.topUsers.map((row) => (
                    <div key={row.userId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.role}</p>
                      </div>
                      <Badge variant="secondary">{row.count} views</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Schakel app-gebruik meten in om data te zien.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">
            Gedetailleerde API-prestaties en cache-instellingen vind je onder{" "}
            <Link href="/settings/performance" className="font-medium text-primary underline-offset-2 hover:underline">
              Prestaties & cache
            </Link>
            .
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
