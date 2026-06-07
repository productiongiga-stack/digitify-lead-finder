"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Link2,
  Loader2,
  QrCode,
  Save,
  Sparkles,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@digitify/ui";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { buildUrl, getAppUrl } from "@/lib/config";
import { ReviewQrCodeCard } from "@/components/reviews/qr-code-card";
import {
  REVIEW_EMBED_TEXT_FIELDS,
  REVIEW_PUBLIC_TEXT_FIELDS,
  REVIEW_TEXT_PLACEHOLDERS,
  getReviewTextDefault,
  type ReviewTextField,
} from "@/lib/review-text";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";

function ReviewTextFieldEditor({
  field,
  value,
  onChange,
}: {
  field: ReviewTextField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/55 bg-muted/15 p-4">
      <Label>{field.label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={field.defaultValue.length > 120 ? 4 : 2}
      />
      <p className="text-xs text-muted-foreground">{field.description}</p>
    </div>
  );
}

export default function ReviewSettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getReviewsSettings.useQuery(undefined, SETTINGS_PAGE_QUERY_OPTS);
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getReviewsSettings.invalidate();
      showToast({
        title: "Review instellingen opgeslagen",
        description: "De review embed en platformlinks zijn bijgewerkt.",
      });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const [loaded, setLoaded] = useState(false);
  const [company, setCompany] = useState("Mijn Bedrijf");
  const [title, setTitle] = useState("Hoe was uw ervaring?");
  const [description, setDescription] = useState(
    "Geef eerst intern een score. Bij 4 of 5 sterren tonen we automatisch de reviewplatformen."
  );
  const [color, setColor] = useState("#f9ae5a");
  const [googleUrl, setGoogleUrl] = useState("");
  const [trustpilotUrl, setTrustpilotUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [textValues, setTextValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!settings || loaded) return;

    const get = (key: string, fallback = "") => {
      const value = settings[key];
      if (value === null || value === undefined) return fallback;
      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return String(parsed);
      } catch {
        return String(value);
      }
    };

    setCompany(get("reviews.embed_company", company));
    setTitle(get("reviews.embed_title", title));
    setDescription(get("reviews.embed_description", description));
    setColor(get("reviews.embed_color", color));
    setGoogleUrl(get("reviews.google_url", ""));
    setTrustpilotUrl(get("reviews.trustpilot_url", ""));
    setFacebookUrl(get("reviews.facebook_url", ""));
    setTextValues(
      Object.fromEntries(
        [...REVIEW_PUBLIC_TEXT_FIELDS, ...REVIEW_EMBED_TEXT_FIELDS].map((field) => [
          field.key,
          get(field.key, field.defaultValue),
        ])
      )
    );
    setLoaded(true);
  }, [settings, loaded, company, title, description, color]);

  const embedCode = useMemo(() => {
    const url = new URL(`${getAppUrl()}/embed/reviews`);
    url.searchParams.set("company", company);
    url.searchParams.set("title", title);
    url.searchParams.set("description", description);
    url.searchParams.set("color", color);
    if (googleUrl.trim()) url.searchParams.set("googleUrl", googleUrl.trim());
    if (trustpilotUrl.trim()) url.searchParams.set("trustpilotUrl", trustpilotUrl.trim());
    if (facebookUrl.trim()) url.searchParams.set("facebookUrl", facebookUrl.trim());
    REVIEW_EMBED_TEXT_FIELDS.forEach((field) => {
      const value = (textValues[field.key] ?? "").trim();
      if (value) url.searchParams.set(field.key, value);
    });

    return `<iframe
  src="${url.toString()}"
  width="100%"
  height="760"
  style="border:0;border-radius:24px;overflow:hidden"
  loading="lazy"
></iframe>`;
  }, [company, title, description, color, googleUrl, trustpilotUrl, facebookUrl, textValues]);

  const standaloneReviewUrl = useMemo(() => {
    const url = new URL(buildUrl("/embed/reviews"));
    url.searchParams.set("company", company);
    url.searchParams.set("title", title);
    url.searchParams.set("description", description);
    url.searchParams.set("color", color);
    if (googleUrl.trim()) url.searchParams.set("googleUrl", googleUrl.trim());
    if (trustpilotUrl.trim()) url.searchParams.set("trustpilotUrl", trustpilotUrl.trim());
    if (facebookUrl.trim()) url.searchParams.set("facebookUrl", facebookUrl.trim());
    REVIEW_EMBED_TEXT_FIELDS.forEach((field) => {
      const value = (textValues[field.key] ?? "").trim();
      if (value) url.searchParams.set(field.key, value);
    });
    return url.toString();
  }, [company, title, description, color, googleUrl, trustpilotUrl, facebookUrl, textValues]);

  const platformQrCards = useMemo(
    () =>
      [
        { key: "google", label: "Google review QR", url: googleUrl.trim() },
        { key: "trustpilot", label: "Trustpilot QR", url: trustpilotUrl.trim() },
        { key: "facebook", label: "Facebook review QR", url: facebookUrl.trim() },
      ].filter((item) => item.url),
    [googleUrl, trustpilotUrl, facebookUrl]
  );

  const configuredPlatformCount = [googleUrl, trustpilotUrl, facebookUrl].filter((url) => url.trim()).length;

  function handleSave() {
    batchUpdate.mutate([
      { key: "reviews.embed_company", value: company },
      { key: "reviews.embed_title", value: title },
      { key: "reviews.embed_description", value: description },
      { key: "reviews.embed_color", value: color },
      { key: "reviews.google_url", value: googleUrl },
      { key: "reviews.trustpilot_url", value: trustpilotUrl },
      { key: "reviews.facebook_url", value: facebookUrl },
      ...Object.entries(textValues).map(([key, value]) => ({ key, value })),
    ]);
  }

  function updateTextValue(key: string, value: string) {
    setTextValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCopy() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    showToast({
      title: "Embed-code gekopieerd",
      description: "De review iframe-code staat nu op je klembord.",
    });
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Terug naar instellingen">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Review Instellingen</h1>
          <p className="text-sm text-muted-foreground">
            Widget, platformlinks, teksten en QR — per onderdeel apart ingesteld.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <Tabs defaultValue="widget" className="space-y-5">
            <TabsList className="settings-domain-tabs settings-domain-tabs-cols-4 w-full">
              <TabsTrigger value="widget" className="settings-domain-tab">
                <Sparkles className="settings-domain-tab-icon" />
                Widget
              </TabsTrigger>
              <TabsTrigger value="platforms" className="settings-domain-tab">
                <Link2 className="settings-domain-tab-icon" />
                Platformen
              </TabsTrigger>
              <TabsTrigger value="texts" className="settings-domain-tab">
                <FileText className="settings-domain-tab-icon" />
                Teksten
              </TabsTrigger>
              <TabsTrigger value="embed" className="settings-domain-tab">
                <QrCode className="settings-domain-tab-icon" />
                Embed &amp; QR
              </TabsTrigger>
            </TabsList>

            <TabsContent value="widget" className="mt-4 space-y-4">
              <div className="rounded-xl border border-border/55 bg-muted/20 p-4">
                <p className="text-sm font-medium">Uiterlijk van de reviewwidget</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bedrijfsnaam, titel, beschrijving en kleur worden gebruikt in de embed, slimme QR en landingspagina.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bedrijfsnaam</Label>
                  <Input value={company} onChange={(event) => setCompany(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Accentkleur</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      className="h-10 w-14 shrink-0 cursor-pointer p-1"
                    />
                    <Input value={color} onChange={(event) => setColor(event.target.value)} placeholder="#f9ae5a" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Beschrijving</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Korte uitleg boven de sterren in de widget en op QR-landingspagina&apos;s.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="platforms" className="mt-4 space-y-4">
              <div className="rounded-xl border border-border/55 bg-muted/20 p-4">
                <p className="text-sm font-medium">Publieke reviewplatformen</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alleen ingevulde links worden getoond na een score van 4 of 5 sterren. Lagere scores gaan naar interne feedback.
                </p>
                <p className="mt-2 text-xs font-medium text-foreground">
                  {configuredPlatformCount === 0
                    ? "Nog geen platform ingesteld"
                    : `${configuredPlatformCount} platform${configuredPlatformCount === 1 ? "" : "en"} actief`}
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Google review URL</Label>
                  <Input
                    value={googleUrl}
                    onChange={(event) => setGoogleUrl(event.target.value)}
                    placeholder="https://g.page/r/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trustpilot URL</Label>
                  <Input
                    value={trustpilotUrl}
                    onChange={(event) => setTrustpilotUrl(event.target.value)}
                    placeholder="https://www.trustpilot.com/evaluate/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Facebook review URL</Label>
                  <Input
                    value={facebookUrl}
                    onChange={(event) => setFacebookUrl(event.target.value)}
                    placeholder="https://www.facebook.com/..."
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="texts" className="mt-4 space-y-4">
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-4">
                <p className="text-sm font-medium">Placeholders</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gebruik deze tags in teksten — ze worden automatisch ingevuld per reviewaanvraag.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {REVIEW_TEXT_PLACEHOLDERS.map((placeholder) => (
                    <code key={placeholder} className="rounded-full bg-background px-3 py-1 text-xs ring-1 ring-border/60">
                      {placeholder}
                    </code>
                  ))}
                </div>
              </div>

              <Tabs defaultValue="public" className="space-y-4">
                <TabsList className="grid h-10 w-full max-w-md grid-cols-2 rounded-full bg-muted/60 p-1">
                  <TabsTrigger
                    value="public"
                    className="rounded-full text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Reviewlink
                  </TabsTrigger>
                  <TabsTrigger
                    value="embed"
                    className="rounded-full text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Widget &amp; QR
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="public" className="mt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Teksten voor de persoonlijke reviewlink die je naar klanten stuurt.
                  </p>
                  {REVIEW_PUBLIC_TEXT_FIELDS.map((field) => (
                    <ReviewTextFieldEditor
                      key={field.key}
                      field={field}
                      value={textValues[field.key] ?? getReviewTextDefault(field.key)}
                      onChange={(value) => updateTextValue(field.key, value)}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="embed" className="mt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Teksten voor de embed op websites en de slimme QR-flow.
                  </p>
                  {REVIEW_EMBED_TEXT_FIELDS.map((field) => (
                    <ReviewTextFieldEditor
                      key={field.key}
                      field={field}
                      value={textValues[field.key] ?? getReviewTextDefault(field.key)}
                      onChange={(value) => updateTextValue(field.key, value)}
                    />
                  ))}
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="embed" className="mt-4 space-y-5">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Embed-code</p>
                  <p className="text-xs text-muted-foreground">
                    Plak deze iframe op de website van de klant of op een landingspagina.
                  </p>
                </div>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-6">
                    {embedCode}
                  </pre>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="absolute right-3 top-3"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    {copied ? "Gekopieerd" : "Kopieer"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewQrCodeCard
                  title="Slimme review QR"
                  description="Opent dezelfde flow als de embed: eerst score, daarna feedback of publieke review."
                  url={standaloneReviewUrl}
                  filename="review-flow-qr"
                />
                <Card className="border-border/55">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tips voor QR-gebruik</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      De slimme QR vangt lagere scores intern op en stuurt alleen tevreden klanten door naar publieke reviews.
                    </p>
                    <p>
                      Sla je instellingen op voordat je QR&apos;s deelt, zodat titel, kleur en platformlinks up-to-date zijn.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {platformQrCards.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Directe platform-QR&apos;s</p>
                    <p className="text-xs text-muted-foreground">
                      Rechtstreeks naar één platform, zonder interne scorefilter.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {platformQrCards.map((item) => (
                      <ReviewQrCodeCard
                        key={item.key}
                        title={item.label}
                        description="Directe link naar het reviewplatform."
                        url={item.url}
                        filename={`${item.key}-review-qr`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  Vul platform-URL&apos;s in onder het tabblad <strong>Platformen</strong> om aparte QR-codes te genereren.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={batchUpdate.isPending} className="shadow-sm">
        {batchUpdate.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {batchUpdate.isPending ? "Opslaan..." : "Alle reviewinstellingen opslaan"}
      </Button>
    </div>
  );
}
