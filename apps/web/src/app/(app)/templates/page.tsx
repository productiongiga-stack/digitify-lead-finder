"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
} from "@digitify/ui";
import {
  ChevronDown,
  LayoutTemplate,
  Palette,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useOutboundEmailPreviewSettings } from "@/lib/outbound-email-settings";
import {
  SystemMessageEditor,
  type SystemMessageItem,
} from "@/components/templates/system-message-editor";
import { SystemMessageCard, type SystemMessageListItem } from "@/components/templates/system-message-card";
import { SystemMessagePreviewDialog } from "@/components/templates/system-message-preview-dialog";

const MODULE_ORDER = ["AUTH", "BOOKINGS", "CAMPAIGNS", "INVOICES", "REVIEWS", "SYSTEM"] as const;

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(item: SystemMessageListItem, query: string) {
  if (!query) return true;
  const haystack = [
    item.name,
    item.templateKey,
    item.trigger,
    item.subject,
    item.moduleLabel,
    item.description,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function TemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [moduleFilter, setModuleFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeMessage, setActiveMessage] = useState<SystemMessageListItem | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const utils = trpc.useUtils();
  const previewSettings = useOutboundEmailPreviewSettings();

  useEffect(() => {
    const moduleParam = searchParams.get("module")?.toUpperCase();
    if (moduleParam && MODULE_ORDER.includes(moduleParam as (typeof MODULE_ORDER)[number])) {
      setModuleFilter(moduleParam);
    }
  }, [searchParams]);

  const { data, isLoading } = trpc.template.listSystemMessages.useQuery({
    module: moduleFilter === "ALL" ? undefined : (moduleFilter as "AUTH"),
  });

  const { data: manualTemplates } = trpc.template.list.useQuery({
    forOutbound: true,
  });

  const allItems = useMemo(
    () => (data?.items ?? []) as SystemMessageListItem[],
    [data?.items],
  );

  const normalizedQuery = normalizeSearch(searchQuery);

  const filteredItems = useMemo(
    () => allItems.filter((item) => matchesSearch(item, normalizedQuery)),
    [allItems, normalizedQuery],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, SystemMessageListItem[]>();
    for (const item of filteredItems) {
      const list = groups.get(item.module) ?? [];
      list.push(item);
      groups.set(item.module, list);
    }
    return MODULE_ORDER.map((moduleId) => ({
      moduleId,
      label: data?.modules.find((m) => m.id === moduleId)?.label ?? moduleId,
      items: groups.get(moduleId) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [filteredItems, data?.modules]);

  const manualOnly = (manualTemplates?.templates ?? []).filter((t) => !t.isSystem);
  const showFlatList = normalizedQuery.length > 0 || moduleFilter !== "ALL";
  const totalCount = allItems.length;
  const visibleCount = filteredItems.length;

  const previewProps = {
    companyName: previewSettings.brandCompanyName || "Digitify",
    primaryColor: previewSettings.brandPrimaryColor || "#6366f1",
    headerSlogan: previewSettings.brandHeaderSlogan,
    masterShellHtml: previewSettings.masterShellHtml,
    signature: previewSettings.emailSignature,
    footer: previewSettings.emailFooter,
  };

  function openEditor(message: SystemMessageListItem) {
    setActiveMessage(message);
    setEditorOpen(true);
  }

  function openPreview(message: SystemMessageListItem) {
    setActiveMessage(message);
    setPreviewOpen(true);
  }

  function setModule(next: string) {
    setModuleFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ALL") params.delete("module");
    else params.set("module", next);
    router.replace(`/templates${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="app-page space-y-5">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Standaard e-mailberichten</h1>
          <p className="app-page-subtitle">
            Bewerk onderwerp, tekst en CTA per automatische mail. De visuele opmaak (logo, kleuren, shell)
            beheer je in{" "}
            <Link href="/settings/email" className="font-medium text-primary underline-offset-2 hover:underline">
              Instellingen → E-mail
            </Link>
            .
          </p>
        </div>
        <div className="app-page-actions flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/email">
              <Palette className="mr-2 h-4 w-4" />
              Mail-opmaak
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/contacts/compose">
              <Send className="mr-2 h-4 w-4" />
              Handmatig opstellen
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Opmaak vs. inhoud</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Alle mails gebruiken je workspace master shell. Hier pas je alleen de berichtteksten aan —
                AI-outreach per lead blijft uniek met dezelfde opmaak.
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" className="shrink-0" asChild>
            <Link href="/settings/email">Opmaak bewerken</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Zoek op naam, onderwerp of trigger…"
                className="pl-9 pr-9"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Zoekopdracht wissen"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {visibleCount === totalCount ? (
                <span>
                  <span className="font-medium text-foreground">{totalCount}</span> berichten
                </span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">{visibleCount}</span> van {totalCount}{" "}
                  berichten
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={moduleFilter === "ALL" ? "default" : "outline"}
              onClick={() => setModule("ALL")}
            >
              Alle modules
            </Button>
            {(data?.modules ?? []).map((module) => (
              <Button
                key={module.id}
                size="sm"
                variant={moduleFilter === module.id ? "default" : "outline"}
                onClick={() => setModule(module.id)}
              >
                {module.label}
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                  {module.count}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : visibleCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground/60" />
            <div>
              <p className="font-medium">Geen berichten gevonden</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Pas je zoekterm of modulefilter aan.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setModule("ALL");
              }}
            >
              Filters wissen
            </Button>
          </CardContent>
        </Card>
      ) : showFlatList ? (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <SystemMessageCard
              key={item.templateKey}
              item={item}
              showModuleBadge
              onPreview={() => openPreview(item)}
              onEdit={() => openEditor(item)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.moduleId} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <div className="h-px flex-1 bg-border/70" />
                <Badge variant="secondary" className="text-[10px]">
                  {group.items.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <SystemMessageCard
                    key={item.templateKey}
                    item={item}
                    onPreview={() => openPreview(item)}
                    onEdit={() => openEditor(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Card>
        <button
          type="button"
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
          onClick={() => setManualOpen((open) => !open)}
        >
          <div>
            <p className="font-medium">Handmatige teksten (optioneel)</p>
            <p className="text-sm text-muted-foreground">
              Snippets voor compose/outbound — niet voor automatische systeemmails
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${manualOpen ? "rotate-180" : ""}`} />
        </button>
        {manualOpen ? (
          <CardContent className="space-y-3 border-t pt-4">
            {manualOnly.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen handmatige teksten. Gebruik AI-outreach per lead of het starter pack via compose.
              </p>
            ) : (
              manualOnly.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-muted-foreground">{template.subject}</p>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/contacts/compose?templateId=${template.id}`}>Gebruiken</Link>
                  </Button>
                </div>
              ))
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href="/contacts/compose">
                <Sparkles className="mr-2 h-4 w-4" />
                Nieuw bericht opstellen
              </Link>
            </Button>
          </CardContent>
        ) : null}
      </Card>

      <SystemMessagePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        message={activeMessage}
        onEdit={() => {
          if (activeMessage) openEditor(activeMessage);
        }}
        preview={previewProps}
      />

      <SystemMessageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        message={activeMessage as SystemMessageItem | null}
        onSaved={() => utils.template.listSystemMessages.invalidate()}
        preview={previewProps}
      />
    </div>
  );
}
