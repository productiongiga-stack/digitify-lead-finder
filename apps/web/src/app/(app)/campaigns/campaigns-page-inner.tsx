"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  CAMPAIGN_STATUS_FILTERS,
  CAMPAIGN_STATUS_LABELS,
  getCampaignStatusVariant,
} from "@/lib/campaign-status";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  StatsCards,
  type StatItem,
  CreateModal,
  EmptyState,
} from "@digitify/ui";
import {
  Plus,
  Target,
  Users,
  FileText,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  LayoutGrid,
  Info,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  CAMPAIGN_PROFILE_OPTIONS,
  getCampaignProfileLabel,
} from "@/lib/campaign-profile";

export function CampaignsPageInner() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: campaignData, isLoading } = trpc.campaign.list.useQuery(
    { page: 1, pageSize: 100 },
    { staleTime: 60_000 },
  );
  const campaigns = campaignData?.items ?? [];
  const { data: topbarStats } = trpc.contact.getTopbarStats.useQuery(undefined, {
    staleTime: 60_000,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const deleteCampaign = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setDeleteId(null);
    },
  });

  const campaignToDelete = campaigns?.find(
    (c: NonNullable<typeof campaigns>[number]) => c.id === deleteId,
  );

  const filteredCampaigns = campaigns?.filter(
    (c: NonNullable<typeof campaigns>[number]) => !statusFilter || c.status === statusFilter,
  );

  const totalCampaigns = campaigns?.length ?? 0;
  const activeCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "ACTIVE")
      .length ?? 0;
  const draftCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "DRAFT").length ??
    0;
  const completedCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "COMPLETED")
      .length ?? 0;
  const insights = useMemo(() => {
    const list = campaigns ?? [];
    const byLeads = (items: typeof list) =>
      [...items].sort((a, b) => b._count.campaignLeads - a._count.campaignLeads);

    const active = byLeads(list.filter((c) => c.status === "ACTIVE"));
    const draft = byLeads(list.filter((c) => c.status === "DRAFT"));
    const paused = byLeads(list.filter((c) => c.status === "PAUSED"));
    const completed = list.filter((c) => c.status === "COMPLETED");

    const totalLeads = list.reduce((sum, c) => sum + c._count.campaignLeads, 0);
    const totalTemplates = list.reduce((sum, c) => sum + c._count.templates, 0);
    const leadsInActive = active.reduce((sum, c) => sum + c._count.campaignLeads, 0);

    const focus =
      active[0] ?? draft[0] ?? paused[0] ?? null;

    return {
      active,
      draft,
      paused,
      completed,
      totalLeads,
      totalTemplates,
      leadsInActive,
      focus,
    };
  }, [campaigns]);

  const stats: StatItem[] = [
    { label: "Totaal", value: isLoading ? "—" : totalCampaigns, icon: <Target /> },
    {
      label: "Actief",
      value: isLoading ? "—" : activeCampaigns,
      icon: <PlayCircle />,
      tone: activeCampaigns > 0 ? "positive" : "neutral",
    },
    { label: "Concept", value: isLoading ? "—" : draftCampaigns, icon: <FileText /> },
    { label: "Afgerond", value: isLoading ? "—" : completedCampaigns, icon: <CheckCircle2 /> },
  ];

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Campagneprofielen</h1>
          <p className="app-page-subtitle">
            Automatiseringen voor leads, review-aanvragen en meer — elk profiel met eigen drip en doelgroep
          </p>
        </div>
        <div className="app-page-actions">
          <Link href="/campaigns/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nieuw profiel
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="page-view-tabs">
          <TabsTrigger value="overview" className="page-view-tabs-trigger">
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            Overzicht
          </TabsTrigger>
          <TabsTrigger value="info" className="page-view-tabs-trigger">
            <Info className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-1.5">
              {CAMPAIGN_STATUS_FILTERS.map(({ key, label }) => (
                <Button
                  key={label}
                  variant={statusFilter === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </Button>
              ))}
              {statusFilter ? (
                <Badge variant="outline" className="h-7 px-2">
                  Filter: {CAMPAIGN_STATUS_LABELS[statusFilter]}
                </Badge>
              ) : null}
            </div>
          </div>

          <StatsCards items={stats} columns={4} loading={isLoading} />

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="mb-3 h-3 w-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCampaigns?.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<Target />}
                  title={
                    statusFilter
                      ? `Geen ${CAMPAIGN_STATUS_LABELS[statusFilter]?.toLowerCase()} campagnes`
                      : "Nog geen campagnes"
                  }
                  description={
                    statusFilter
                      ? "Wijzig het filter of maak een nieuwe campagne aan."
                      : "Maak je eerste campagne aan om leads te organiseren."
                  }
                  action={
                    statusFilter ? (
                      <Button size="sm" variant="outline" onClick={() => setStatusFilter(undefined)}>
                        Alle campagnes tonen
                      </Button>
                    ) : (
                      <Link href="/campaigns/new">
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Nieuw profiel
                        </Button>
                      </Link>
                    )
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns?.map((campaign: NonNullable<typeof campaigns>[number]) => (
                <Card
                  key={campaign.id}
                  className="h-full transition-all hover:shadow-md hover:border-primary/20"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/campaigns/${campaign.id}`} className="min-w-0 flex-1">
                        <CardTitle className="truncate text-sm hover:text-primary">
                          {campaign.name}
                        </CardTitle>
                      </Link>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {getCampaignProfileLabel(
                            (campaign as { profileType?: string }).profileType,
                          )}
                        </Badge>
                        <Badge variant={getCampaignStatusVariant(campaign.status)}>
                          {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => e.preventDefault()}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/campaigns/${campaign.id}`)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Bewerken
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(campaign.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <Link href={`/campaigns/${campaign.id}`}>
                    <CardContent className="space-y-2.5">
                      {campaign.description ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {campaign.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {campaign.niche ? (
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" /> {campaign.niche}
                          </span>
                        ) : null}
                        {campaign.region ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {campaign.region}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {campaign._count.campaignLeads} leads
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {campaign._count.templates}
                        </span>
                        <span className="ml-auto">{formatDate(campaign.createdAt)}</span>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-2 text-xs">
                        <p className="font-medium text-foreground">
                          {campaign.status === "DRAFT"
                            ? "Volgende: voeg leads toe en activeer de drip."
                            : campaign.status === "ACTIVE"
                              ? "Volgende: verwerk geplande stappen en volg op."
                              : campaign.status === "PAUSED"
                                ? "Volgende: hervat wanneer de timing weer juist is."
                                : "Deze campagne is afgerond of gearchiveerd."}
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <span className="inline-flex items-center text-xs font-medium text-primary">
                          Open campagne
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Volgende focus
                </p>
                {isLoading ? (
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ) : insights.focus ? (
                  <>
                    <p className="mt-2 text-base font-semibold leading-tight">{insights.focus.name}</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {CAMPAIGN_STATUS_LABELS[insights.focus.status] || insights.focus.status}
                      {" · "}
                      {insights.focus._count.campaignLeads} leads
                      {" · "}
                      {insights.focus._count.templates} template
                      {insights.focus._count.templates !== 1 ? "s" : ""}
                      {insights.focus.niche ? ` · ${insights.focus.niche}` : ""}
                    </p>
                    {insights.active.length > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {insights.active.length} actief
                        {insights.active.length > 1
                          ? ` · ${insights.leadsInActive} leads in actieve campagnes`
                          : null}
                        {insights.draft.length > 0
                          ? ` · ${insights.draft.length} concept${insights.draft.length !== 1 ? "en" : ""}`
                          : null}
                      </p>
                    ) : insights.draft.length > 0 ? (
                      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                        Geen actieve campagne — activeer een concept om outreach te starten.
                      </p>
                    ) : insights.paused.length > 0 ? (
                      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                        Alleen gepauzeerde campagnes — hervat om verder te gaan.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm font-medium">
                    Nog geen profielen. Maak een lead- of review-automatisering aan.
                  </p>
                )}
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link
                    href={
                      insights.focus
                        ? `/campaigns/${insights.focus.id}`
                        : "/campaigns/new"
                    }
                  >
                    {insights.focus ? "Open profiel" : "Nieuw profiel"}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Wachtrij &amp; portfolio
                </p>
                {isLoading ? (
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ) : (
                  <div className="mt-2 space-y-3 text-sm">
                    {insights.paused.length > 0 ? (
                      <div>
                        <p className="font-medium">
                          {insights.paused.length} gepauzeerd
                        </p>
                        <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                          {insights.paused.slice(0, 4).map((campaign) => (
                            <li key={campaign.id}>
                              <Link
                                href={`/campaigns/${campaign.id}`}
                                className="font-medium text-foreground hover:text-primary"
                              >
                                {campaign.name}
                              </Link>
                              {" · "}
                              {campaign._count.campaignLeads} leads
                            </li>
                          ))}
                          {insights.paused.length > 4 ? (
                            <li>+{insights.paused.length - 4} meer</li>
                          ) : null}
                        </ul>
                      </div>
                    ) : insights.draft.length > 0 ? (
                      <div>
                        <p className="font-medium">
                          {insights.draft.length} concept
                          {insights.draft.length !== 1 ? "en" : ""} zonder activatie
                        </p>
                        <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                          {insights.draft.slice(0, 3).map((campaign) => (
                            <li key={campaign.id}>
                              <Link
                                href={`/campaigns/${campaign.id}`}
                                className="font-medium text-foreground hover:text-primary"
                              >
                                {campaign.name}
                              </Link>
                              {" · "}
                              {campaign._count.campaignLeads} leads klaar
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="font-medium text-muted-foreground">
                        Geen gepauzeerde of concept-campagnes in de wachtrij.
                      </p>
                    )}

                    <div className="rounded-lg border border-amber-200/60 bg-background/50 px-2.5 py-2 text-xs dark:border-amber-900/40">
                      <p>
                        <span className="font-medium text-foreground">{insights.totalLeads}</span> leads
                        {" · "}
                        <span className="font-medium text-foreground">{insights.totalTemplates}</span> gekoppelde
                        templates
                        {insights.completed.length > 0
                          ? ` · ${insights.completed.length} afgerond`
                          : null}
                      </p>
                      {(topbarStats?.pendingDrafts ?? 0) > 0 ? (
                        <p className="mt-1 text-amber-900 dark:text-amber-100">
                          {topbarStats?.pendingDrafts} outbound-mail
                          {(topbarStats?.pendingDrafts ?? 0) !== 1 ? "s" : ""} wacht op goedkeuring
                        </p>
                      ) : null}
                      {(topbarStats?.followUpCount ?? 0) > 0 ? (
                        <p className="mt-1 text-muted-foreground">
                          {topbarStats?.followUpCount} lead
                          {(topbarStats?.followUpCount ?? 0) !== 1 ? "s" : ""} met aanbevolen follow-up
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gerelateerde acties
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Vanuit campagnes naar outbound, templates en goedkeuring.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button asChild size="sm" variant="outline" className="justify-between">
                    <Link href="/contacts/approval" className="flex w-full items-center justify-between">
                      <span>Goedkeuringen</span>
                      {(topbarStats?.pendingDrafts ?? 0) > 0 ? (
                        <Badge variant="warning" className="ml-2 shrink-0">
                          {topbarStats?.pendingDrafts}
                        </Badge>
                      ) : null}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="justify-start">
                    <Link href="/contacts">Outbound center</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="justify-start">
                    <Link href="/templates">E-mailtemplates</Link>
                  </Button>
                  {insights.focus && insights.focus._count.campaignLeads > 0 ? (
                    <Button asChild size="sm" variant="ghost" className="justify-start">
                      <Link href={`/contacts/compose?campaignId=${insights.focus.id}`}>
                        E-mail opstellen
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <CreateModal
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Campagne verwijderen"
        description="Deze actie kan niet ongedaan worden gemaakt."
        submitLabel="Verwijderen"
        submitVariant="destructive"
        pending={deleteCampaign.isPending}
        onSubmit={() => {
          if (deleteId) deleteCampaign.mutate({ id: deleteId });
        }}
      >
        <p className="text-sm text-muted-foreground">
          Weet je zeker dat je &quot;{campaignToDelete?.name}&quot; wilt verwijderen? Alle
          gekoppelde leads en templates blijven bestaan, maar zijn niet meer aan deze campagne
          verbonden.
        </p>
      </CreateModal>
    </div>
  );
}
