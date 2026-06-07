"use client";

import { use, useEffect, useMemo, useState } from "react";
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
  Input,
  Textarea,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@digitify/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatsCards,
  type StatItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@digitify/ui";
import {
  ArrowLeft,
  Users,
  Target,
  MapPin,
  Star,
  Mail,
  Send,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
  BarChart3,
  Search,
  Sparkles,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  CalendarClock,
} from "lucide-react";
import { formatDate, formatScore } from "@/lib/utils";
import { CAMPAIGN_STATUS_LABELS, getCampaignStatusVariant } from "@/lib/campaign-status";
import {
  CampaignLeadsTable,
  type CampaignLeadRow,
} from "@/components/campaigns/campaign-leads-table";
import { CampaignDripSetup } from "@/components/campaigns/campaign-drip-setup";
import {
  getAudienceSectionTitle,
  getCampaignProfileLabel,
  getDefaultDripModeForProfile,
} from "@/lib/campaign-profile";

export function CampaignDetailInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const [leadsPage, setLeadsPage] = useState(1);
  const leadsPageSize = 25;

  const { data: campaign, isLoading } = trpc.campaign.getById.useQuery({
    id,
    leadsPage,
    leadsPageSize,
  });
  const { data: stats, isLoading: statsLoading } = trpc.campaign.getStats.useQuery({ id });

  const campaignStatItems = useMemo<StatItem[]>(
    () => [
      {
        label: "Total Leads",
        value: stats?.totalLeads ?? 0,
        icon: <Users />,
        tone: "neutral",
        hint: "Gekoppeld aan campagne",
      },
      {
        label: "Gem. Score",
        value: formatScore(stats?.avgScore),
        icon: <BarChart3 />,
        tone: "warning",
        hint: "Gemiddelde leadscore",
      },
      {
        label: "E-mails Draft",
        value: stats?.emailsDraft ?? 0,
        icon: <Mail />,
        tone: "info",
        hint: "Nog niet verzonden",
      },
      {
        label: "E-mails Verstuurd",
        value: stats?.emailsSent ?? 0,
        icon: <Send />,
        tone: "positive",
        hint: "Succesvol afgeleverd",
      },
      {
        label: "Goedgekeurd",
        value: stats?.emailsApproved ?? 0,
        icon: <PlayCircle />,
        tone: "info",
        hint: "Klaar om te verzenden",
      },
      {
        label: "Mislukt",
        value: stats?.emailsFailed ?? 0,
        icon: <PauseCircle />,
        tone: (stats?.emailsFailed ?? 0) > 0 ? "negative" : "neutral",
        hint: (stats?.emailsFailed ?? 0) > 0 ? "Controleer en herstuur" : "Geen fouten",
      },
    ],
    [stats?.avgScore, stats?.emailsDraft, stats?.emailsFailed, stats?.emailsScheduled, stats?.emailsSent, stats?.totalLeads],
  );

  const campaignLeadRows = useMemo<CampaignLeadRow[]>(() => {
    if (!campaign) return [];
    return campaign.campaignLeads.map((cl) => ({
      leadId: cl.lead.id,
      companyName: cl.lead.companyName,
      email: cl.lead.email,
      city: cl.lead.city,
      website: cl.lead.website,
      overallScore: cl.lead.overallScore,
      status: cl.lead.status,
      addedAt: cl.addedAt,
      tags: cl.lead.tags,
      emailDrafts: cl.lead.emailDrafts
        .filter((d) => d.sequenceStep != null)
        .map((d) => ({
          id: d.id,
          sequenceStep: d.sequenceStep as number,
          status: d.status,
          subject: d.subject,
          scheduledFor: d.scheduledFor,
          sentAt: d.sentAt,
          openedAt: d.openedAt,
        })),
    }));
  }, [campaign]);

  const campaignKpiItems = useMemo<StatItem[]>(() => {
    if (!stats) return [];

    const total = stats.totalLeads;
    const sb = stats.statusBreakdown ?? {};
    const responded =
      (sb.RESPONDED ?? 0) + (sb.QUALIFIED ?? 0) + (sb.WON ?? 0) + (sb.PROPOSAL_SENT ?? 0);
    const stillNew = sb.NEW ?? 0;

    const totalTouchpoints =
      stats.emailsDraft +
      stats.emailsScheduled +
      stats.emailsSent +
      stats.emailsFailed +
      (stats.emailsApproved ?? 0);
    const sendRate =
      totalTouchpoints > 0 ? Math.round((stats.emailsSent / totalTouchpoints) * 100) : 0;

    const actionQueue = stats.emailsDraft + (stats.emailsApproved ?? 0);

    const leadsWithDraft = campaignLeadRows.filter(
      (row) => (row.emailDrafts?.length ?? 0) > 0,
    ).length;
    const dripCoverage = total > 0 ? Math.round((leadsWithDraft / total) * 100) : 0;

    const idealScore = campaign?.idealScore;
    const qualifiedLeads =
      idealScore != null
        ? campaignLeadRows.filter(
            (row) => row.overallScore != null && row.overallScore >= idealScore,
          ).length
        : 0;
    const qualityPct = total > 0 && idealScore != null ? Math.round((qualifiedLeads / total) * 100) : 0;

    return [
      {
        label: "Verzendvoortgang",
        value: totalTouchpoints > 0 ? `${sendRate}%` : "—",
        icon: <TrendingUp />,
        tone: sendRate >= 40 ? "positive" : totalTouchpoints > 0 ? "info" : "neutral",
        hint: `${stats.emailsSent} verzonden · ${stats.emailsScheduled} ingepland`,
      },
      {
        label: "Actie nodig",
        value: actionQueue,
        icon: <Mail />,
        tone: actionQueue > 0 ? "warning" : "neutral",
        hint:
          actionQueue > 0
            ? "Concepten of goedkeuring open"
            : stats.emailsFailed > 0
              ? `${stats.emailsFailed} mislukt — check queue`
              : "Geen openstaande drafts",
      },
      {
        label: "Gereageerd",
        value: responded,
        icon: <MessageSquare />,
        tone: responded > 0 ? "positive" : "neutral",
        hint:
          total > 0
            ? `${Math.round((responded / total) * 100)}% van ${total} leads`
            : "Nog geen reacties",
      },
      {
        label: idealScore != null ? "Score ≥ drempel" : "Leads in drip",
        value:
          idealScore != null
            ? qualityPct > 0
              ? `${qualityPct}%`
              : "0%"
            : total > 0
              ? `${leadsWithDraft}/${total}`
              : "—",
        icon: idealScore != null ? <Star /> : <Users />,
        tone:
          idealScore != null
            ? qualityPct >= 50
              ? "positive"
              : "warning"
            : dripCoverage >= 50
              ? "positive"
              : "info",
        hint:
          idealScore != null
            ? `${qualifiedLeads} leads ≥ ${idealScore}${stillNew > 0 ? ` · ${stillNew} nog nieuw` : ""}`
            : `${dripCoverage}% met minstens één mail in drip`,
      },
    ];
  }, [campaign?.idealScore, campaignLeadRows, stats]);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    niche: "",
    region: "",
    targetAudience: "",
    idealScore: 0,
    toneOfVoice: "",
    goal: "",
    status: "",
  });

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Add leads dialog
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [dripMode, setDripMode] = useState<"lead" | "review">("lead");

  const profileType =
    (campaign as { profileType?: string } | undefined)?.profileType ?? "LEAD_OUTREACH";
  const isReviewProfile = profileType === "REVIEW_REQUEST";

  useEffect(() => {
    if (campaign) {
      setDripMode(getDefaultDripModeForProfile(profileType));
    }
  }, [campaign, profileType]);

  const { data: leadsData, isLoading: leadsLoading } =
    trpc.lead.list.useQuery(
      {
        filters: { search: leadSearch || undefined },
        page: 1,
        pageSize: 50,
      },
      { enabled: addLeadsOpen }
    );

  const updateCampaign = trpc.campaign.update.useMutation({
    onSuccess: () => {
      utils.campaign.getById.invalidate({ id });
      utils.campaign.getStats.invalidate({ id });
      setEditing(false);
    },
  });

  const deleteCampaign = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      router.push("/campaigns");
    },
  });

  const addLeads = trpc.campaign.addLeads.useMutation({
    onSuccess: () => {
      utils.campaign.getById.invalidate({ id });
      utils.campaign.getStats.invalidate({ id });
      setAddLeadsOpen(false);
      setSelectedLeadIds([]);
      setLeadSearch("");
    },
  });

  const removeLeads = trpc.campaign.removeLeads.useMutation({
    onSuccess: () => {
      utils.campaign.getById.invalidate({ id });
      utils.campaign.getStats.invalidate({ id });
    },
  });

  const generateDrafts = trpc.campaign.generateDrafts.useMutation({
    onSuccess: () => {
      utils.campaign.getById.invalidate({ id });
      utils.campaign.getStats.invalidate({ id });
    },
  });

  const activateAll = trpc.campaign.activateAll.useMutation({
    onSuccess: () => {
      utils.campaign.getById.invalidate({ id });
      utils.campaign.getStats.invalidate({ id });
    },
  });

  const runDueDrip = trpc.campaign.runDueDrip.useMutation({
    onSuccess: () => {
      utils.campaign.getById.invalidate({ id });
      utils.campaign.getStats.invalidate({ id });
    },
  });

  function startEditing() {
    if (!campaign) return;
    setEditForm({
      name: campaign.name,
      description: campaign.description || "",
      niche: campaign.niche || "",
      region: campaign.region || "",
      targetAudience: campaign.targetAudience || "",
      idealScore: campaign.idealScore ?? 0,
      toneOfVoice: campaign.toneOfVoice || "",
      goal: campaign.goal || "",
      status: campaign.status,
    });
    setEditing(true);
  }

  function handleSaveEdit() {
    updateCampaign.mutate({
      id,
      name: editForm.name,
      description: editForm.description || null,
      niche: editForm.niche || null,
      region: editForm.region || null,
      targetAudience: editForm.targetAudience || null,
      idealScore: editForm.idealScore || null,
      toneOfVoice: editForm.toneOfVoice || null,
      goal: editForm.goal || null,
      status: editForm.status,
    });
  }

  function handleStatusChange(newStatus: string) {
    updateCampaign.mutate({ id, status: newStatus });
  }

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  }

  // Filter out leads already in campaign
  const existingLeadIds = new Set(
    campaign?.campaignLeads.map((cl: NonNullable<typeof campaign>["campaignLeads"][number]) => cl.lead.id) ?? []
  );
  const availableLeads =
    leadsData?.items.filter((l: NonNullable<typeof leadsData>["items"][number]) => !existingLeadIds.has(l.id)) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-12" /></CardContent></Card>
          ))}
        </div>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Campagne niet gevonden</p>
        <Link href="/campaigns">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar campagnes
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-page-header">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="app-page-title">{campaign.name}</h1>
            <Badge variant="outline">{getCampaignProfileLabel(profileType)}</Badge>
            <Badge variant={getCampaignStatusVariant(campaign.status)}>
              {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground">
              {campaign.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {campaign.niche ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                <Target className="h-3 w-3 shrink-0" />
                {campaign.niche}
              </span>
            ) : null}
            {campaign.region ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {campaign.region}
              </span>
            ) : null}
            {campaign.idealScore != null ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 shrink-0" />
                Score ≥ {campaign.idealScore}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {campaign.createdBy?.name ?? "Onbekend"} · {formatDate(campaign.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button variant="outline" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Bewerken
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Campagne bewerken</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Naam</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, status: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Concept</SelectItem>
                    <SelectItem value="ACTIVE">Actief</SelectItem>
                    <SelectItem value="PAUSED">Gepauzeerd</SelectItem>
                    <SelectItem value="COMPLETED">Voltooid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Beschrijving</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Niche</Label>
                <Input
                  value={editForm.niche}
                  onChange={(e) =>
                    setEditForm({ ...editForm, niche: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Regio</Label>
                <Input
                  value={editForm.region}
                  onChange={(e) =>
                    setEditForm({ ...editForm, region: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Doelgroep</Label>
                <Textarea
                  value={editForm.targetAudience}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      targetAudience: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ideale Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.idealScore}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      idealScore: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tone of Voice</Label>
                <Input
                  value={editForm.toneOfVoice}
                  onChange={(e) =>
                    setEditForm({ ...editForm, toneOfVoice: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Doelstelling</Label>
                <Input
                  value={editForm.goal}
                  onChange={(e) =>
                    setEditForm({ ...editForm, goal: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                disabled={!editForm.name || updateCampaign.isPending}
                onClick={handleSaveEdit}
              >
                {updateCampaign.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Opslaan
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Annuleren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!editing ? (
        <Tabs defaultValue="workflow" className="space-y-3">
          <TabsList className="page-view-tabs">
            <TabsTrigger value="workflow" className="page-view-tabs-trigger">
              Campagne
            </TabsTrigger>
            <TabsTrigger value="drip" className="page-view-tabs-trigger">
              <CalendarClock className="mr-1.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
              Drip-campagne
            </TabsTrigger>
            <TabsTrigger value="stats" className="page-view-tabs-trigger">
              <BarChart3 className="mr-1.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
              Statistieken
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-0 space-y-3">
            <StatsCards
              items={campaignStatItems}
              columns={6}
              variant="rich"
              loading={statsLoading}
              aria-label="Campagne statistieken"
            />
            <StatsCards
              items={campaignKpiItems}
              columns={4}
              variant="rich"
              loading={statsLoading}
              aria-label="Campagne KPI's"
            />
          </TabsContent>

          <TabsContent value="drip" className="mt-0 space-y-3">
            <CampaignDripSetup
              campaignId={id}
              dripMode={dripMode}
              onDripModeChange={setDripMode}
              campaignStatus={campaign.status}
              profileType={profileType}
              onRunDueDrip={() => runDueDrip.mutate({ campaignId: id, mode: dripMode })}
              runDueDripPending={runDueDrip.isPending}
            />

            {activateAll.isSuccess && activateAll.data && (
              <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium text-emerald-800 dark:text-emerald-200">
                    Profiel actief — {activateAll.data.totalLeads} contacten
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Concepten: stap 1 {activateAll.data.generatedStep1} · stap 2{" "}
                    {activateAll.data.generatedStep2} · stap 3 {activateAll.data.generatedStep3}
                    {activateAll.data.skippedResponded > 0
                      ? ` · ${activateAll.data.skippedResponded} overgeslagen (reeds gereageerd)`
                      : ""}
                  </p>
                  {activateAll.data.errors.length > 0 && (
                    <ul className="text-xs text-red-600 space-y-1">
                      {activateAll.data.errors.slice(0, 6).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {runDueDrip.isSuccess && runDueDrip.data && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Goedgekeurde stappen verwerkt
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Klaar: {runDueDrip.data.due} · Verzonden: {runDueDrip.data.sent} · Gestopt:{" "}
                    {runDueDrip.data.stopped} · Fouten: {runDueDrip.data.failed}
                  </p>
                </CardContent>
              </Card>
            )}

            {(activateAll.isError || runDueDrip.isError) && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                <CardContent className="p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {activateAll.error?.message || runDueDrip.error?.message}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="workflow" className="mt-0 space-y-3">
            {isReviewProfile ? (
              <Card className="border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <p className="text-muted-foreground">
                    Review-profiel: koppel klanten (leads) hieronder en beheer losse aanvragen in het
                    review-center.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/reviews">Naar review-center</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex flex-wrap gap-2">
        {campaign.status === "DRAFT" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateDrafts.mutate({ campaignId: id, mode: dripMode })}
            disabled={generateDrafts.isPending}
          >
            {generateDrafts.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3.5 w-3.5" />
            )}
            Alleen stap 1 (AI)
          </Button>
        )}
        {campaign.status === "ACTIVE" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange("PAUSED")}
            disabled={updateCampaign.isPending}
          >
            <PauseCircle className="mr-2 h-3.5 w-3.5" />
            Pauzeren
          </Button>
        )}
        {campaign.status === "PAUSED" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange("ACTIVE")}
            disabled={updateCampaign.isPending}
          >
            <PlayCircle className="mr-2 h-3.5 w-3.5" />
            Hervatten
          </Button>
        )}
        {(campaign.status === "ACTIVE" || campaign.status === "PAUSED") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange("COMPLETED")}
            disabled={updateCampaign.isPending}
          >
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
            Afronden
          </Button>
        )}
      </div>

      {/* Generate Drafts Result */}
      {generateDrafts.isSuccess && generateDrafts.data && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {generateDrafts.data.generated} van {generateDrafts.data.total} drafts aangemaakt
              {generateDrafts.data.skippedExisting > 0 ? ` · ${generateDrafts.data.skippedExisting} bestonden al` : ""}
            </p>
            {generateDrafts.data.errors.length > 0 && (
              <ul className="mt-2 text-xs text-red-600 space-y-1">
                {generateDrafts.data.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {generateDrafts.isError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              {generateDrafts.error.message}
            </p>
          </CardContent>
        </Card>
      )}

      <CampaignLeadsTable
        leads={campaignLeadRows}
        audienceTitle={getAudienceSectionTitle(profileType)}
        addButtonLabel={isReviewProfile ? "Klanten toevoegen" : "Leads toevoegen"}
        onAddLeads={() => setAddLeadsOpen(true)}
        onRemoveLead={(leadId) =>
          removeLeads.mutate({ campaignId: id, leadIds: [leadId] })
        }
        removing={removeLeads.isPending}
      />
      {(campaign?.campaignLeadsTotal ?? 0) > leadsPageSize ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Pagina {campaign?.campaignLeadsPage ?? leadsPage} van {campaign?.campaignLeadsTotalPages ?? 1}
            {" · "}
            {campaign?.campaignLeadsTotal ?? 0} leads
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={leadsPage <= 1}
              onClick={() => setLeadsPage((page) => Math.max(1, page - 1))}
            >
              Vorige
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(campaign?.campaignLeadsPage ?? leadsPage) >= (campaign?.campaignLeadsTotalPages ?? 1)}
              onClick={() => setLeadsPage((page) => page + 1)}
            >
              Volgende
            </Button>
          </div>
        </div>
      ) : null}
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Add Leads Dialog */}
      <Dialog open={addLeadsOpen} onOpenChange={setAddLeadsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Leads toevoegen aan campagne</DialogTitle>
            <DialogDescription>
              Zoek en selecteer leads om aan deze campagne toe te voegen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek op bedrijfsnaam, e-mail, stad..."
                className="pl-9"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded-md border">
              {leadsLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Laden...
                </div>
              ) : availableLeads.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Geen leads gevonden
                </div>
              ) : (
                availableLeads.map((lead: NonNullable<typeof leadsData>["items"][number]) => (
                  <div
                    key={lead.id}
                    className={`flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/50 ${
                      selectedLeadIds.includes(lead.id)
                        ? "bg-primary/5"
                        : ""
                    }`}
                    onClick={() => toggleLeadSelection(lead.id)}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        selectedLeadIds.includes(lead.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {selectedLeadIds.includes(lead.id) && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {lead.companyName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[lead.city, lead.industry]
                          .filter(Boolean)
                          .join(" \u2022 ")}
                      </p>
                    </div>
                    {lead.overallScore !== null &&
                      lead.overallScore !== undefined && (
                        <span className="text-sm font-bold">
                          {formatScore(lead.overallScore)}
                        </span>
                      )}
                  </div>
                ))
              )}
            </div>
            {selectedLeadIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedLeadIds.length} lead(s) geselecteerd
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddLeadsOpen(false);
                setSelectedLeadIds([]);
              }}
            >
              Annuleren
            </Button>
            <Button
              disabled={
                selectedLeadIds.length === 0 || addLeads.isPending
              }
              onClick={() =>
                addLeads.mutate({
                  campaignId: id,
                  leadIds: selectedLeadIds,
                })
              }
            >
              {addLeads.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Toevoegen ({selectedLeadIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campagne verwijderen</DialogTitle>
            <DialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Weet je zeker dat je de campagne &quot;{campaign.name}&quot; wilt
            verwijderen? Alle gekoppelde leads worden losgekoppeld (niet verwijderd).
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCampaign.isPending}
              onClick={() => deleteCampaign.mutate({ id })}
            >
              {deleteCampaign.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
