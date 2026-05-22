"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Skeleton,
} from "@digitify/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import {
  Copy,
  LayoutTemplate,
  Library,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  EMPTY_STUDIO_FORM,
  TemplateStudioEditor,
  starterToForm,
  templateToForm,
  type StudioForm,
} from "@/components/templates/template-studio-editor";
import {
  LAYOUT_CATALOG,
  TEMPLATE_TYPES,
  templateTypeLabel,
  type TemplateType,
} from "@/lib/template-studio";
import type { RouterOutputs } from "@/lib/trpc/client";
import { TemplateScopeHelp } from "@/components/templates/template-scope-help";

type StarterTemplate = RouterOutputs["template"]["starterPack"]["items"][number];
export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TemplateType | "ALL">("ALL");
  const [campaignFilterId, setCampaignFilterId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<StudioForm>(EMPTY_STUDIO_FORM);

  const utils = trpc.useUtils();
  const { data: campaigns } = trpc.campaign.list.useQuery();
  const { data, isLoading } = trpc.template.list.useQuery({
    type: typeFilter === "ALL" ? undefined : typeFilter,
    search: search.trim() || undefined,
    campaignId: campaignFilterId || undefined,
  });
  const { data: starterPack } = trpc.template.starterPack.useQuery(undefined, {
    staleTime: Infinity,
  });
  const { data: brandingSettings } = trpc.settings.getAll.useQuery(undefined, { staleTime: 60_000 });
  const { data: legacyStatus } = trpc.template.legacyLibraryStatus.useQuery();

  const remove = trpc.template.remove.useMutation({
    onSuccess: () => utils.template.list.invalidate(),
  });
  const duplicate = trpc.template.duplicate.useMutation({
    onSuccess: () => utils.template.list.invalidate(),
  });
  const seedPack = trpc.template.seedStarterPack.useMutation({
    onSuccess: (result) => {
      utils.template.list.invalidate();
      if (result.created > 0) return;
    },
  });
  const migrate = trpc.template.migrateLegacyLibrary.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      utils.template.legacyLibraryStatus.invalidate();
    },
  });

  const previewCompanyName = brandingSettings?.["branding.company_name"]
    ? String(brandingSettings["branding.company_name"])
    : "Digitify";
  const previewPrimaryColor = brandingSettings?.["branding.primary_color"]
    ? String(brandingSettings["branding.primary_color"])
    : "#f59e0b";
  const previewHeaderSlogan = brandingSettings?.["email.header_slogan"]
    ? String(brandingSettings["email.header_slogan"])
    : "";

  const templates = data?.templates || [];
  const layoutAccent = useMemo(
    () => Object.fromEntries(LAYOUT_CATALOG.map((l) => [l.id, l.accent])) as Record<string, string>,
    [],
  );

  function openCreate(fromStarter?: StarterTemplate) {
    setForm(fromStarter ? starterToForm(fromStarter) : { ...EMPTY_STUDIO_FORM });
    setEditorOpen(true);
  }

  function openEdit(template: (typeof templates)[number]) {
    setForm(templateToForm(template));
    setEditorOpen(true);
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Template Studio</h1>
          <p className="app-page-subtitle">
            Maak unieke e-mailtemplates per type en layout. Elk template heeft een eigen HTML-stijl en wordt direct gebruikt in Outbound.
          </p>
        </div>
        <div className="app-page-actions flex flex-wrap gap-2">
          {legacyStatus?.hasLegacy ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => migrate.mutate()}
              disabled={migrate.isPending}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {migrate.isPending ? "Migreren..." : `Legacy migreren (${legacyStatus.pending})`}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedPack.mutate()}
            disabled={seedPack.isPending}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {seedPack.isPending ? "Laden..." : "Starter pack"}
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuw template
          </Button>
        </div>
      </div>

      {legacyStatus?.hasLegacy ? (
        <Card className="border-amber-300/70 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Oude template-library gevonden
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {legacyStatus.pending} item(s) staan nog in JSON-instellingen. Migreer naar Template Studio vóór je RLS op
                productie aanzet.
              </p>
            </div>
            <Button size="sm" onClick={() => migrate.mutate()} disabled={migrate.isPending}>
              <Wand2 className="mr-2 h-4 w-4" />
              {migrate.isPending ? "Migreren..." : "Nu migreren"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <TemplateScopeHelp variant="studio" />

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="lg:w-56 shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Zoek templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Campagne-filter
            </p>
            <Select
              value={campaignFilterId || "all"}
              onValueChange={(value) => setCampaignFilterId(value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-9" data-testid="template-campaign-filter">
                <SelectValue placeholder="Alle templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle campagnes + globaal</SelectItem>
                {(campaigns ?? []).map((campaign: { id: string; name: string }) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5 lg:flex-col">
            <Button
              variant={typeFilter === "ALL" ? "default" : "outline"}
              size="sm"
              className="justify-start"
              onClick={() => setTypeFilter("ALL")}
            >
              Alles ({data?.total ?? 0})
            </Button>
            {TEMPLATE_TYPES.map((entry) => (
              <Button
                key={entry.id}
                variant={typeFilter === entry.id ? "default" : "outline"}
                size="sm"
                className="justify-start"
                onClick={() => setTypeFilter(entry.id)}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-2xl" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card className="app-surface">
              <CardContent className="py-8">
                <EmptyState
                  icon={<Library />}
                  title="Nog geen templates"
                  description="Start met het starter pack of maak je eerste unieke template."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" onClick={() => seedPack.mutate()} disabled={seedPack.isPending}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Starter pack laden
                      </Button>
                      <Button onClick={() => openCreate()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nieuw template
                      </Button>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="group cursor-pointer overflow-hidden border-border/60 transition-shadow hover:shadow-md"
                  onClick={() => openEdit(template)}
                >
                  <div className={`h-1.5 bg-gradient-to-r ${layoutAccent[template.layout] || "from-slate-400 to-slate-600"}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{template.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{template.subject}</p>
                      </div>
                      <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {templateTypeLabel(template.type)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {template.layout}
                      </Badge>
                      {template.ctaText ? (
                        <Badge className="text-[10px]">CTA</Badge>
                      ) : null}
                      {template.isGlobal ? (
                        <Badge variant="outline" className="text-[10px]">
                          Alle campagnes
                        </Badge>
                      ) : null}
                    </div>
                    {template.description ? (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{template.cleanBody}</p>
                    )}
                    {template.campaign ? (
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        {template.campaign.name}
                      </Badge>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">{formatDate(template.updatedAt)}</span>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicate.mutate({ id: template.id });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Template verwijderen?")) remove.mutate({ id: template.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="app-surface">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium">Snel starten — unieke starter templates</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(starterPack?.items ?? []).map((starter) => (
                  <button
                    key={starter.name}
                    type="button"
                    onClick={() => openCreate(starter)}
                    className="rounded-xl border border-border/60 bg-background/45 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className={`mb-2 h-1 rounded-full bg-gradient-to-r ${layoutAccent[starter.layout]}`} />
                    <p className="text-sm font-medium">{starter.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{starter.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TemplateStudioEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        form={form}
        onFormChange={setForm}
        onSaved={() => utils.template.list.invalidate()}
        previewCompanyName={previewCompanyName}
        previewPrimaryColor={previewPrimaryColor}
        previewHeaderSlogan={previewHeaderSlogan}
      />
    </div>
  );
}
