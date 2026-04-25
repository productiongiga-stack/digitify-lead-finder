"use client";

import { use, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@digitify/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import {
  ArrowLeft,
  Users,
  Target,
  MapPin,
  Star,
  Globe,
  Mail,
  Send,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Loader2,
  BarChart3,
  User,
  Search,
  Sparkles,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
} from "lucide-react";
import { formatDate, formatScore, getStatusBadgeVariant } from "@/lib/utils";
import { CAMPAIGN_STATUS_LABELS, getCampaignStatusVariant } from "@/lib/campaign-status";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: campaign, isLoading } = trpc.campaign.getById.useQuery({ id });
  const { data: stats } = trpc.campaign.getStats.useQuery({ id });

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={getCampaignStatusVariant(campaign.status)}>
              {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground">
              {campaign.description}
            </p>
          )}
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

      {/* Stats - using server-side getStats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalLeads ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <BarChart3 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.avgScore ?? 0}</p>
                <p className="text-xs text-muted-foreground">Gem. Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.emailsDraft ?? 0}</p>
                <p className="text-xs text-muted-foreground">E-mails Draft</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Send className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.emailsSent ?? 0}</p>
                <p className="text-xs text-muted-foreground">E-mails Verstuurd</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <PlayCircle className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.emailsScheduled ?? 0}</p>
                <p className="text-xs text-muted-foreground">Gepland</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <PauseCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.emailsFailed ?? 0}</p>
                <p className="text-xs text-muted-foreground">Mislukt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volgende stap</p>
            <p className="mt-2 text-sm font-medium">
              {campaign.status === "DRAFT"
                ? "Genereer eerst stap 1 drafts of activeer meteen de volledige drip."
                : campaign.status === "ACTIVE"
                  ? "Verwerk geplande stappen en check mislukte of stilgevallen leads."
                  : campaign.status === "PAUSED"
                    ? "Deze campagne staat stil. Hervat wanneer de timing weer juist is."
                    : "Deze campagne is afgerond. Gebruik de resultaten als referentie voor volgende campagnes."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drip queue</p>
            <p className="mt-2 text-sm font-medium">
              {stats?.emailsScheduled ?? 0} ingepland · {stats?.emailsFailed ?? 0} mislukt · {stats?.emailsSent ?? 0} verzonden
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Zo zie je in één oogopslag of deze campagne nog verwerking of troubleshooting nodig heeft.
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aansluitende acties</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/contacts">Open outbound center</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/contacts/approval">Bekijk approvals</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2">
        <Select value={dripMode} onValueChange={(value) => setDripMode(value as "lead" | "review")}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">Lead drip</SelectItem>
            <SelectItem value="review">Review drip</SelectItem>
          </SelectContent>
        </Select>

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
          AI drafts (stap 1)
        </Button>

        {campaign.status === "DRAFT" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => activateAll.mutate({ campaignId: id, mode: dripMode })}
            disabled={activateAll.isPending}
          >
            {activateAll.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-3.5 w-3.5" />
            )}
            Activeer all (3-step drip)
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
            onClick={() => runDueDrip.mutate({ campaignId: id, mode: dripMode })}
            disabled={runDueDrip.isPending}
          >
            {runDueDrip.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-2 h-3.5 w-3.5" />
            )}
            Verwerk geplande stappen
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

      {activateAll.isSuccess && activateAll.data && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              Drip gestart voor {activateAll.data.totalLeads} leads
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Stap1 drafts: {activateAll.data.generatedStep1} · Stap2: {activateAll.data.generatedStep2} · Stap3: {activateAll.data.generatedStep3}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Stap1 verzonden: {activateAll.data.sentStep1} · skipped door respons: {activateAll.data.skippedResponded}
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
              Geplande stappen verwerkt
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Due: {runDueDrip.data.due} · Verzonden: {runDueDrip.data.sent} · Gestopt: {runDueDrip.data.stopped} · Fouten: {runDueDrip.data.failed}
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
      {generateDrafts.isError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              {generateDrafts.error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Campaign Info (when not editing) */}
      {!editing && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Niche</p>
                  <p className="text-sm font-medium">
                    {campaign.niche || "\u2014"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Regio</p>
                  <p className="text-sm font-medium">
                    {campaign.region || "\u2014"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Ideale Score</p>
                  <p className="text-sm font-medium">
                    {campaign.idealScore ?? "\u2014"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Aangemaakt door</p>
                  <p className="text-sm font-medium">
                    {campaign.createdBy?.name || "\u2014"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(campaign.createdAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaign Leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Leads in deze campagne</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setAddLeadsOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Leads toevoegen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {campaign.campaignLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">Geen leads</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Voeg leads toe aan deze campagne om te beginnen.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setAddLeadsOpen(true)}
              >
                <UserPlus className="mr-2 h-3.5 w-3.5" />
                Leads Toevoegen
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bedrijf</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Drip status</TableHead>
                  <TableHead>Signalen</TableHead>
                  <TableHead>Toegevoegd</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.campaignLeads.map((cl: NonNullable<typeof campaign>["campaignLeads"][number]) => {
                  const leadAny = cl.lead as any;
                  const draftCount = leadAny.emailDrafts?.length ?? 0;
                  const latestDraft = leadAny.emailDrafts?.[0];
                  const step1 = leadAny.emailDrafts?.find((draft: any) => draft.sequenceStep === 1);
                  const step2 = leadAny.emailDrafts?.find((draft: any) => draft.sequenceStep === 2);
                  const step3 = leadAny.emailDrafts?.find((draft: any) => draft.sequenceStep === 3);
                  return (
                    <TableRow key={cl.lead.id}>
                      <TableCell>
                        <Link
                          href={`/leads/${cl.lead.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {cl.lead.companyName}
                        </Link>
                        <div className="mt-1 flex gap-1">
                          {cl.lead.tags?.map((lt: any) => (
                            <Badge
                              key={lt.tag.id}
                              variant="outline"
                              className="text-[10px] px-1 py-0"
                              style={{
                                borderColor: lt.tag.color,
                                color: lt.tag.color,
                              }}
                            >
                              {lt.tag.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-lg font-bold">
                          {formatScore(cl.lead.overallScore)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(cl.lead.status)}>
                          {cl.lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {draftCount > 0 ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={step1?.status === "SENT" ? "success" : step1?.status === "FAILED" ? "destructive" : "secondary"} className="text-[10px]">
                                1: {step1?.status || "n.v.t."}
                              </Badge>
                              <Badge variant={step2?.status === "SENT" ? "success" : step2?.status === "FAILED" ? "destructive" : "secondary"} className="text-[10px]">
                                2: {step2?.status || "n.v.t."}
                              </Badge>
                              <Badge variant={step3?.status === "SENT" ? "success" : step3?.status === "FAILED" ? "destructive" : "secondary"} className="text-[10px]">
                                3: {step3?.status || "n.v.t."}
                              </Badge>
                            </div>
                            {latestDraft ? (
                              <Link href={`/contacts/drafts/${latestDraft.id}`} className="text-xs text-primary hover:underline">
                                Bekijk draft
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Geen draft</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {cl.lead.website ? (
                            <Globe className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Globe className="h-3.5 w-3.5 text-red-400" />
                          )}
                          {cl.lead.email && (
                            <Mail className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(cl.addedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {latestDraft ? (
                            <Link href={`/contacts/drafts/${latestDraft.id}`}>
                              <Button variant="ghost" size="sm">
                                Draft openen
                              </Button>
                            </Link>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={removeLeads.isPending}
                            onClick={() =>
                              removeLeads.mutate({
                                campaignId: id,
                                leadIds: [cl.lead.id],
                              })
                            }
                          >
                            <UserMinus className="mr-1 h-3.5 w-3.5" />
                            Verwijderen
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
