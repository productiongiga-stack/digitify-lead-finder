"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { CAMPAIGN_STATUS_FILTERS, CAMPAIGN_STATUS_LABELS, getCampaignStatusVariant } from "@/lib/campaign-status";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@digitify/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Loader2,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
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
    (c: NonNullable<typeof campaigns>[number]) => c.id === deleteId
  );

  const filteredCampaigns = campaigns?.filter(
    (c: NonNullable<typeof campaigns>[number]) => !statusFilter || c.status === statusFilter
  );

  // Stats
  const totalCampaigns = campaigns?.length ?? 0;
  const activeCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "ACTIVE").length ?? 0;
  const draftCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "DRAFT").length ?? 0;
  const completedCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "COMPLETED").length ?? 0;
  const pausedCampaigns =
    campaigns?.filter((c: NonNullable<typeof campaigns>[number]) => c.status === "PAUSED").length ?? 0;
  const topPriorityCampaign = campaigns?.find((campaign) => campaign.status === "ACTIVE")
    ?? campaigns?.find((campaign) => campaign.status === "DRAFT")
    ?? campaigns?.[0];

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Campagnes</h1>
          <p className="app-page-subtitle">
            Beheer je lead generation campagnes
          </p>
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-2">
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
                <Badge variant="outline" className="h-9 px-3">
                  Filter: {CAMPAIGN_STATUS_LABELS[statusFilter]}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isLoading ? "-" : totalCampaigns}</p>
                    <p className="text-xs text-muted-foreground">Totaal Campagnes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <PlayCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isLoading ? "-" : activeCampaigns}</p>
                    <p className="text-xs text-muted-foreground">Actief</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-500/10 p-2">
                    <FileText className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isLoading ? "-" : draftCampaigns}</p>
                    <p className="text-xs text-muted-foreground">Concept</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isLoading ? "-" : completedCampaigns}</p>
                    <p className="text-xs text-muted-foreground">Afgerond</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <CardContent className="flex h-48 flex-col items-center justify-center text-center">
                <Target className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">
                  {statusFilter ? `Geen ${CAMPAIGN_STATUS_LABELS[statusFilter]?.toLowerCase()} campagnes` : "Nog geen campagnes"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {statusFilter
                    ? "Wijzig het filter of maak een nieuwe campagne aan."
                    : "Maak je eerste campagne aan om leads te organiseren."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns?.map((campaign: NonNullable<typeof campaigns>[number]) => (
                <Card
                  key={campaign.id}
                  className="h-full transition-all hover:shadow-md hover:border-primary/20"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <Link href={`/campaigns/${campaign.id}`} className="flex-1">
                        <CardTitle className="text-base hover:text-primary">
                          {campaign.name}
                        </CardTitle>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant={getCampaignStatusVariant(campaign.status)}>
                          {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.preventDefault()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/campaigns/${campaign.id}`)
                              }
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
                    <CardContent className="space-y-3">
                      {campaign.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {campaign.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {campaign.niche && (
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" /> {campaign.niche}
                          </span>
                        )}
                        {campaign.region && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {campaign.region}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />{" "}
                          {campaign._count.campaignLeads} leads
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />{" "}
                          {campaign._count.templates} templates
                        </span>
                        <span className="ml-auto">
                          {formatDate(campaign.createdAt)}
                        </span>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                        <p className="font-medium text-foreground">
                          {campaign.status === "DRAFT"
                            ? "Volgende stap: voeg leads toe en activeer de drip."
                            : campaign.status === "ACTIVE"
                              ? "Volgende stap: verwerk geplande stappen en volg de resultaten op."
                              : campaign.status === "PAUSED"
                                ? "Volgende stap: hervat wanneer de timing opnieuw juist is."
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

        <TabsContent value="info" className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volgende focus</p>
                <p className="mt-2 text-sm font-medium">
                  {activeCampaigns > 0
                    ? `${activeCampaigns} actieve campagne${activeCampaigns !== 1 ? "s" : ""} vragen opvolging of drip-verwerking.`
                    : draftCampaigns > 0
                      ? `${draftCampaigns} conceptcampagne${draftCampaigns !== 1 ? "s" : ""} kunnen geactiveerd worden.`
                      : "Geen open acties. Tijd om een nieuwe campagne te starten."}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href={topPriorityCampaign ? `/campaigns/${topPriorityCampaign.id}` : "/campaigns/new"}>
                    {topPriorityCampaign ? "Open aanbevolen campagne" : "Nieuwe campagne"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wachtrij</p>
                <p className="mt-2 text-sm font-medium">
                  {pausedCampaigns > 0
                    ? `${pausedCampaigns} campagne${pausedCampaigns !== 1 ? "s" : ""} staan gepauzeerd en kunnen opnieuw gestart worden.`
                    : "Er staan momenteel geen gepauzeerde campagnes klaar voor hervatting."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Gebruik dit als snelle werkqueue om campagnes opnieuw momentum te geven.
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerelateerde acties</p>
                <div className="mt-3 flex flex-wrap gap-2">
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

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campagne verwijderen</DialogTitle>
            <DialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Weet je zeker dat je de campagne &quot;{campaignToDelete?.name}
            &quot; wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCampaign.isPending}
              onClick={() => deleteId && deleteCampaign.mutate({ id: deleteId })}
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
