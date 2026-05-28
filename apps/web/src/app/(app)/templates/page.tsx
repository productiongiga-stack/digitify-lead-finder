"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from "@digitify/ui";
import {
  Copy,
  LayoutTemplate,
  Library,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  EMPTY_STUDIO_FORM,
  TemplateStudioEditor,
  starterToForm,
  templateToForm,
  type StudioForm,
} from "@/components/templates/template-studio-editor";
import { templateTypeLabel, type TemplateType } from "@/lib/template-studio";
import type { RouterOutputs } from "@/lib/trpc/client";
import { TemplateScopeHelp } from "@/components/templates/template-scope-help";
import { TemplateStudioToolbar } from "@/components/templates/template-studio-toolbar";

type StarterTemplate = RouterOutputs["template"]["starterPack"]["items"][number];

const TEMPLATE_CARD_ACCENT: Record<string, string> = {
  OUTREACH: "templates-catalog-accent-outreach",
  FOLLOW_UP: "templates-catalog-accent-followup",
  PROPOSAL: "templates-catalog-accent-proposal",
  REPORT: "templates-catalog-accent-report",
  BOOKING: "templates-catalog-accent-booking",
  REVIEW: "templates-catalog-accent-review",
  REENGAGEMENT: "templates-catalog-accent-reengagement",
  CUSTOM: "templates-catalog-accent-custom",
};

function templateExcerpt(template: { description?: string | null; cleanBody?: string | null }) {
  const raw = (template.description?.trim() || template.cleanBody?.trim() || "").replace(/\s+/g, " ");
  if (!raw) return "Geen preview beschikbaar";
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

export default function TemplatesPage() {
  const router = useRouter();
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
  const { data: countData } = trpc.template.list.useQuery({
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
  const typeCounts = useMemo(() => {
    const items = countData?.templates ?? [];
    const counts: Partial<Record<TemplateType | "ALL", number>> = { ALL: items.length };
    for (const template of items) {
      const key = template.type as TemplateType;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [countData?.templates]);
  function openCreate(fromStarter?: StarterTemplate) {
    setForm(fromStarter ? starterToForm(fromStarter) : { ...EMPTY_STUDIO_FORM });
    setEditorOpen(true);
  }

  function openEdit(template: (typeof templates)[number]) {
    setForm(templateToForm(template));
    setEditorOpen(true);
  }

  function openOutbound(templateId: string) {
    router.push(`/contacts/compose?templateId=${templateId}`);
  }

  return (
    <div className="app-page space-y-4">
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
          <Button variant="outline" size="sm" asChild>
            <Link href="/contacts/compose">
              <Send className="mr-2 h-4 w-4" />
              Outbound opstellen
            </Link>
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

      <div className="templates-studio-layout">
        <aside className="templates-studio-sidebar">
          <TemplateStudioToolbar
            variant="sidebar"
            search={search}
            onSearchChange={setSearch}
            campaignFilterId={campaignFilterId}
            onCampaignFilterChange={setCampaignFilterId}
            campaigns={campaigns ?? []}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            typeCounts={typeCounts}
          />
        </aside>

        <section className="templates-studio-main" aria-label="Opgeslagen templates">
          <div className="templates-studio-main-header">
            <div>
              <p className="templates-studio-main-title">Bibliotheek</p>
              <p className="templates-studio-main-meta">
                {isLoading
                  ? "Templates laden…"
                  : `${templates.length} template${templates.length === 1 ? "" : "s"} in deze selectie`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => openCreate()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nieuw
            </Button>
          </div>

          {isLoading ? (
            <div className="templates-catalog-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card className="border-border/60 bg-card/95">
              <CardContent className="py-10">
                <EmptyState
                  icon={<Library />}
                  title="Nog geen templates"
                  description="Start met het starter pack hieronder of maak je eerste template."
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
            <div className="templates-catalog-grid">
              {templates.map((template) => (
                <article
                  key={template.id}
                  className={cn(
                    "group templates-catalog-card",
                    TEMPLATE_CARD_ACCENT[template.type] ?? TEMPLATE_CARD_ACCENT.CUSTOM,
                  )}
                  onClick={() => openEdit(template)}
                >
                  <div className="templates-catalog-card-accent" aria-hidden="true" />
                  <div className="templates-catalog-card-body">
                    <div className="templates-catalog-card-header">
                      <span className="templates-catalog-card-icon" aria-hidden>
                        <LayoutTemplate className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="templates-catalog-card-title">{template.name}</h3>
                        <p className="templates-catalog-card-subject">{template.subject}</p>
                      </div>
                    </div>

                    <div className="templates-catalog-tags">
                      <span className="templates-catalog-tag">{templateTypeLabel(template.type)}</span>
                      <span className="templates-catalog-tag templates-catalog-tag-muted">
                        {template.layout}
                      </span>
                      {template.bodyFormat === "HTML" ? (
                        <span className="templates-catalog-tag templates-catalog-tag-muted">HTML</span>
                      ) : null}
                      {template.ctaText ? (
                        <span className="templates-catalog-tag templates-catalog-tag-cta">CTA</span>
                      ) : null}
                    </div>

                    <div className="templates-catalog-preview">
                      <p>{templateExcerpt(template)}</p>
                    </div>

                    <div className="templates-catalog-meta">
                      <span>{formatDate(template.updatedAt)}</span>
                      {template.campaign ? (
                        <span className="templates-catalog-meta-badge">{template.campaign.name}</span>
                      ) : template.isGlobal ? (
                        <span className="templates-catalog-meta-badge">Globaal</span>
                      ) : null}
                    </div>

                    <div
                      className="templates-catalog-card-actions"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      <Button
                        size="sm"
                        className="templates-catalog-outbound-btn h-8 flex-1 px-3 text-xs sm:flex-none"
                        onClick={() => openOutbound(template.id)}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Outbound
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="templates-catalog-icon-btn h-8 w-8"
                        title="Dupliceren"
                        onClick={() => duplicate.mutate({ id: template.id })}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="templates-catalog-icon-btn templates-catalog-icon-btn-danger h-8 w-8"
                        title="Verwijderen"
                        onClick={() => {
                          if (confirm("Template verwijderen?")) remove.mutate({ id: template.id });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="templates-studio-starter" aria-label="Starter templates">
        <div className="templates-studio-starter-header">
          <div>
            <p className="templates-studio-starter-title">Snel starten</p>
            <p className="templates-studio-starter-sub">
              Unieke starter templates — elk met eigen layout en copy
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wide">
            Starter pack
          </Badge>
        </div>
        <div className="templates-studio-starter-body">
          <div className="templates-starter-grid">
            {(starterPack?.items ?? []).map((starter) => (
              <button
                key={starter.name}
                type="button"
                onClick={() => openCreate(starter)}
                className="templates-starter-card"
              >
                <p className="text-sm font-semibold leading-snug text-foreground">{starter.name}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{starter.description}</p>
                <p className="templates-starter-card-meta">
                  {templateTypeLabel(starter.type)} · {starter.layout}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

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
