"use client";

import { useState } from "react";
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
  PauseCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CampaignsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaign.list.useQuery();
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
  const pausedCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "PAUSED")
      .length ?? 0;
  const topPriorityCampaign =
    campaigns?.find((c) => c.status === "ACTIVE") ??
    campaigns?.find((c) => c.status === "DRAFT") ??
    campaigns?.[0];

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
          <h1 className="app-page-title">Campagnes</h1>
          <p className="app-page-subtitle">Beheer je lead generation campagnes</p>
        </div>
        <div className="app-page-actions">
          <Link href="/campaigns/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe Campagne
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
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
                          Nieuwe Campagne
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
                      <div className="flex shrink-0 items-center gap-1">
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
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Volgende focus
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  {activeCampaigns > 0
                    ? `${activeCampaigns} actieve campagne${activeCampaigns !== 1 ? "s" : ""} vragen opvolging.`
                    : draftCampaigns > 0
                      ? `${draftCampaigns} conceptcampagne${draftCampaigns !== 1 ? "s" : ""} kunnen geactiveerd worden.`
                      : "Geen open acties. Tijd voor een nieuwe campagne."}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2.5">
                  <Link
                    href={
                      topPriorityCampaign
                        ? `/campaigns/${topPriorityCampaign.id}`
                        : "/campaigns/new"
                    }
                  >
                    {topPriorityCampaign ? "Open aanbevolen campagne" : "Nieuwe campagne"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Wachtrij
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  {pausedCampaigns > 0
                    ? `${pausedCampaigns} gepauzeerde campagne${pausedCampaigns !== 1 ? "s" : ""}.`
                    : "Er staan geen gepauzeerde campagnes klaar."}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <PauseCircle className="mr-1 inline h-3 w-3" />
                  Snelle werkqueue om campagnes momentum te geven.
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gerelateerde acties
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/contacts/approval">Goedkeuringen</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/contacts">Outbound center</Link>
                  </Button>
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
        onSubmit={() => deleteId && deleteCampaign.mutate({ id: deleteId })}
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
