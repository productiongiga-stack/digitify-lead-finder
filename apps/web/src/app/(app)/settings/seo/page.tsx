"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OpenClawPageAssist } from "@/components/openclaw/openclaw-page-assist";
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
import { ArrowLeft, ExternalLink, Globe2, Loader2, Save } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { getAppUrl } from "@/lib/config";
import { MARKETING_SOLUTION_SLUGS } from "@/lib/seo/solution-slugs";

const TWITTER_CARD_OPTIONS = [
  { value: "summary_large_image", label: "Grote afbeelding" },
  { value: "summary", label: "Compact" },
] as const;

const OG_LOCALE_OPTIONS = ["nl_BE", "nl_NL", "en_US", "fr_BE", "de_DE"] as const;

function normalizeOgLocale(value: string) {
  const match = OG_LOCALE_OPTIONS.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  return match ?? "nl_BE";
}

const PAGE_FIELDS = [
  { key: "home", label: "Home", titleKey: "seo.page_home_title", descKey: "seo.page_home_description" },
  { key: "product", label: "Product", titleKey: "seo.page_product_title", descKey: "seo.page_product_description" },
  { key: "solutions", label: "Oplossingen", titleKey: "seo.page_solutions_title", descKey: "seo.page_solutions_description" },
  { key: "about", label: "Over ons", titleKey: "seo.page_about_title", descKey: "seo.page_about_description" },
  { key: "contact", label: "Contact", titleKey: "seo.page_contact_title", descKey: "seo.page_contact_description" },
] as const;

function readSetting(settings: Record<string, unknown> | undefined, key: string, fallback = ""): string {
  const val = settings?.[key];
  if (val === null || val === undefined) return fallback;
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}

function readBool(settings: Record<string, unknown> | undefined, key: string, fallback: boolean) {
  const raw = readSetting(settings, key, fallback ? "true" : "false");
  return raw === "true" || raw === "1";
}

export default function SeoSettingsPage() {
  const pathname = usePathname();
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();
  const { data: publicSeo } = trpc.settings.getPublicSeo.useQuery();
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      utils.settings.getPublicSeo.invalidate();
      showToast({
        title: "SEO opgeslagen",
        description: "Marketingpagina's en sitemap gebruiken deze instellingen.",
      });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const [loaded, setLoaded] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [canonicalBaseUrl, setCanonicalBaseUrl] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [ogLocale, setOgLocale] = useState("nl_BE");
  const [twitterCard, setTwitterCard] = useState("summary_large_image");
  const [twitterSite, setTwitterSite] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [googleVerification, setGoogleVerification] = useState("");
  const [bingVerification, setBingVerification] = useState("");
  const [yandexVerification, setYandexVerification] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState("");
  const [structuredDataEnabled, setStructuredDataEnabled] = useState(true);
  const [pageTitles, setPageTitles] = useState<Record<string, string>>({});
  const [pageDescriptions, setPageDescriptions] = useState<Record<string, string>>({});
  const [solutionPagesJson, setSolutionPagesJson] = useState("");

  useEffect(() => {
    if (!settings || loaded) return;

    setSiteName(readSetting(settings, "seo.site_name"));
    setDefaultTitle(readSetting(settings, "seo.default_title"));
    setDefaultDescription(readSetting(settings, "seo.default_description"));
    setKeywords(readSetting(settings, "seo.keywords"));
    setCanonicalBaseUrl(readSetting(settings, "seo.canonical_base_url", getAppUrl()));
    setOgImageUrl(readSetting(settings, "seo.og_image_url"));
    setOgLocale(normalizeOgLocale(readSetting(settings, "seo.og_locale", "nl_BE")));
    setTwitterCard(readSetting(settings, "seo.twitter_card", "summary_large_image"));
    setTwitterSite(readSetting(settings, "seo.twitter_site"));
    setRobotsIndex(readBool(settings, "seo.robots_index", true));
    setRobotsFollow(readBool(settings, "seo.robots_follow", true));
    setGoogleVerification(readSetting(settings, "seo.google_site_verification"));
    setBingVerification(readSetting(settings, "seo.bing_site_verification"));
    setYandexVerification(readSetting(settings, "seo.yandex_verification"));
    setOrganizationName(readSetting(settings, "seo.organization_name"));
    setOrganizationLogoUrl(readSetting(settings, "seo.organization_logo_url"));
    setStructuredDataEnabled(readBool(settings, "seo.structured_data_enabled", true));

    const titles: Record<string, string> = {};
    const descriptions: Record<string, string> = {};
    for (const field of PAGE_FIELDS) {
      titles[field.key] = readSetting(settings, field.titleKey);
      descriptions[field.key] = readSetting(settings, field.descKey);
    }
    setPageTitles(titles);
    setPageDescriptions(descriptions);

    const rawSolutions = settings["seo.solution_pages_json"];
    if (rawSolutions) {
      try {
        const parsed = typeof rawSolutions === "string" ? JSON.parse(rawSolutions) : rawSolutions;
        setSolutionPagesJson(JSON.stringify(parsed, null, 2));
      } catch {
        setSolutionPagesJson(String(rawSolutions));
      }
    } else {
      setSolutionPagesJson("{}");
    }

    setLoaded(true);
  }, [settings, loaded]);

  const previewUrls = useMemo(() => {
    const base = (canonicalBaseUrl || publicSeo?.canonicalBaseUrl || getAppUrl()).replace(/\/$/, "");
    return {
      sitemap: `${base}/sitemap.xml`,
      robots: `${base}/robots.txt`,
      home: `${base}/`,
    };
  }, [canonicalBaseUrl, publicSeo?.canonicalBaseUrl]);

  const solutionExample = useMemo(() => {
    const example: Record<string, { title: string; description: string }> = {};
    for (const slug of MARKETING_SOLUTION_SLUGS.slice(0, 2)) {
      example[slug] = {
        title: `Voorbeeldtitel — ${slug}`,
        description: "Optionele meta description voor deze oplossingspagina.",
      };
    }
    return JSON.stringify(example, null, 2);
  }, []);

  async function handleSave() {
    let parsedSolutions = "{}";
    if (solutionPagesJson.trim()) {
      try {
        const parsed = JSON.parse(solutionPagesJson);
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Oplossingen JSON moet een object zijn.");
        }
        parsedSolutions = JSON.stringify(parsed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ongeldige JSON";
        showToast({ title: "Oplossingen JSON", description: message, variant: "error" });
        return;
      }
    }

    const updates: { key: string; value: string | boolean }[] = [
      { key: "seo.site_name", value: siteName },
      { key: "seo.default_title", value: defaultTitle },
      { key: "seo.default_description", value: defaultDescription },
      { key: "seo.keywords", value: keywords },
      { key: "seo.canonical_base_url", value: canonicalBaseUrl },
      { key: "seo.og_image_url", value: ogImageUrl },
      { key: "seo.og_locale", value: ogLocale },
      { key: "seo.twitter_card", value: twitterCard },
      { key: "seo.twitter_site", value: twitterSite },
      { key: "seo.robots_index", value: robotsIndex },
      { key: "seo.robots_follow", value: robotsFollow },
      { key: "seo.google_site_verification", value: googleVerification },
      { key: "seo.bing_site_verification", value: bingVerification },
      { key: "seo.yandex_verification", value: yandexVerification },
      { key: "seo.organization_name", value: organizationName },
      { key: "seo.organization_logo_url", value: organizationLogoUrl },
      { key: "seo.structured_data_enabled", value: structuredDataEnabled },
      { key: "seo.solution_pages_json", value: parsedSolutions },
    ];

    for (const field of PAGE_FIELDS) {
      updates.push({ key: field.titleKey, value: pageTitles[field.key] ?? "" });
      updates.push({ key: field.descKey, value: pageDescriptions[field.key] ?? "" });
    }

    await batchUpdate.mutateAsync(updates);
  }

  if (isLoading || !loaded) {
    return (
      <div className="app-page max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="app-page max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Instellingen
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="app-page-title flex items-center gap-2">
            <Globe2 className="h-6 w-6 text-primary" />
            SEO & vindbaarheid
          </h1>
          <p className="app-page-subtitle">
            Beheer hoe marketingpagina&apos;s verschijnen in Google, Bing en andere zoekmachines.
          </p>
        </div>
        <Button onClick={handleSave} disabled={batchUpdate.isPending}>
          {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Opslaan
        </Button>
      </div>

      <OpenClawPageAssist pathname={pathname} />

      <Card className="app-surface border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Live technische bestanden</CardTitle>
          <CardDescription>
            Na opslaan worden metadata, sitemap en robots.txt automatisch bijgewerkt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a
            href={previewUrls.sitemap}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            sitemap.xml <ExternalLink className="ml-1 h-3 w-3" />
          </a>
          <a
            href={previewUrls.robots}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            robots.txt <ExternalLink className="ml-1 h-3 w-3" />
          </a>
          <a
            href={previewUrls.home}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            Marketing home <ExternalLink className="ml-1 h-3 w-3" />
          </a>
          {!robotsIndex && (
            <Badge variant="destructive">Indexeren uitgeschakeld — site niet vindbaar</Badge>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="general">Algemeen</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="pages">Pagina&apos;s</TabsTrigger>
          <TabsTrigger value="advanced">Geavanceerd</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">Site & standaard meta</CardTitle>
              <CardDescription>Fallback titel en beschrijving voor alle marketingpagina&apos;s.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo-site-name">Sitenaam</Label>
                <Input id="seo-site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Digitify Lead Finder" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-default-title">Standaard titel</Label>
                <Input id="seo-default-title" value={defaultTitle} onChange={(e) => setDefaultTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-default-description">Standaard beschrijving</Label>
                <Textarea id="seo-default-description" rows={3} value={defaultDescription} onChange={(e) => setDefaultDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-keywords">Keywords (komma-gescheiden)</Label>
                <Input id="seo-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="lead generation, outreach, CRM" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-canonical">Canonical basis-URL</Label>
                <Input
                  id="seo-canonical"
                  value={canonicalBaseUrl}
                  onChange={(e) => setCanonicalBaseUrl(e.target.value)}
                  placeholder="https://leads.digitify.be"
                />
                <p className="text-xs text-muted-foreground">Gebruik je productie-domein (zonder trailing slash).</p>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">Indexering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Laat zoekmachines indexeren</p>
                  <p className="text-xs text-muted-foreground">Schakel uit op staging of tijdens onderhoud.</p>
                </div>
                <Switch checked={robotsIndex} onCheckedChange={setRobotsIndex} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Links volgen (follow)</p>
                  <p className="text-xs text-muted-foreground">Staat crawlers toe om links te volgen.</p>
                </div>
                <Switch checked={robotsFollow} onCheckedChange={setRobotsFollow} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">Open Graph & Twitter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo-og-image">OG-afbeelding URL</Label>
                <Input id="seo-og-image" value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} placeholder="https://…/og-image.jpg" />
                <p className="text-xs text-muted-foreground">Leeg = branding logo indien ingesteld.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seo-og-locale">Taal/regio</Label>
                  <select
                    id="seo-og-locale"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ogLocale}
                    onChange={(e) => setOgLocale(e.target.value)}
                  >
                    {OG_LOCALE_OPTIONS.map((locale) => (
                      <option key={locale} value={locale}>
                        {locale}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo-twitter-card">Twitter card</Label>
                  <select
                    id="seo-twitter-card"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={twitterCard}
                    onChange={(e) => setTwitterCard(e.target.value)}
                  >
                    {TWITTER_CARD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-twitter-site">Twitter / X account</Label>
                <Input id="seo-twitter-site" value={twitterSite} onChange={(e) => setTwitterSite(e.target.value)} placeholder="@digitify" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          {PAGE_FIELDS.map((field) => (
            <Card key={field.key} className="app-surface">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{field.label}</CardTitle>
                <CardDescription>Optioneel — leeg laat de standaard marketingtekst staan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input
                    value={pageTitles[field.key] ?? ""}
                    onChange={(e) => setPageTitles((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beschrijving</Label>
                  <Textarea
                    rows={2}
                    value={pageDescriptions[field.key] ?? ""}
                    onChange={(e) => setPageDescriptions((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">Oplossingspagina&apos;s (JSON)</CardTitle>
              <CardDescription>
                Per slug een optionele titel en beschrijving. Slugs: {MARKETING_SOLUTION_SLUGS.join(", ")}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={12}
                className="font-mono text-xs"
                value={solutionPagesJson}
                onChange={(e) => setSolutionPagesJson(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Voorbeeld:</p>
              <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">{solutionExample}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">Zoekmachine verificatie</CardTitle>
              <CardDescription>Plak de content-waarde uit Google Search Console, Bing Webmaster of Yandex.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo-google">Google site verification</Label>
                <Input id="seo-google" value={googleVerification} onChange={(e) => setGoogleVerification(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-bing">Bing site verification</Label>
                <Input id="seo-bing" value={bingVerification} onChange={(e) => setBingVerification(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-yandex">Yandex verification</Label>
                <Input id="seo-yandex" value={yandexVerification} onChange={(e) => setYandexVerification(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">Structured data (JSON-LD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Organization & WebSite schema</p>
                  <p className="text-xs text-muted-foreground">Helpt Google je merk en site te begrijpen.</p>
                </div>
                <Switch checked={structuredDataEnabled} onCheckedChange={setStructuredDataEnabled} />
              </div>
              <div className="space-y-2">
                <Label>Organisatienaam</Label>
                <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Organisatie logo URL</Label>
                <Input value={organizationLogoUrl} onChange={(e) => setOrganizationLogoUrl(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader>
              <CardTitle className="text-base">Publieke workspace</CardTitle>
              <CardDescription>
                Marketing SEO gebruikt dezelfde workspace als de publieke footer (
                <code className="text-xs">PUBLIC_MARKETING_WORKSPACE_ID</code> in Vercel).
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {publicSeo ? (
                <ul className="list-inside list-disc space-y-1">
                  <li>Canonical: {publicSeo.canonicalBaseUrl}</li>
                  <li>Indexeren: {publicSeo.robotsIndex ? "aan" : "uit"}</li>
                  <li>Structured data: {publicSeo.structuredDataEnabled ? "aan" : "uit"}</li>
                </ul>
              ) : (
                <p>Geen publieke SEO-config geladen.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
