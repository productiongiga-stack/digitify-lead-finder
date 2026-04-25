"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Save, Settings2, Star } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
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
} from "@/lib/review-text";

export default function ReviewSettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
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
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/settings"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar instellingen
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Settings2 className="h-6 w-6" />
          Review Instellingen
        </h1>
        <p className="text-sm text-muted-foreground">
          Beheer hier je reviewflow, teksten, QR-codes en platformlinks. Alles hieronder wordt gebruikt door de reviewpagina, embed en slimme QR.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4" />
              Basis Configuratie
            </CardTitle>
            <CardDescription>
              Deze instellingen sturen de reviewwidget, slimme QR en platformdoorsturing aan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bedrijfsnaam</Label>
              <Input value={company} onChange={(event) => setCompany(event.target.value)} />
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
                Deze titel en beschrijving worden vooral gebruikt in de embed en slimme QR flow.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Kleur</Label>
              <Input value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
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

            <Button onClick={handleSave} disabled={batchUpdate.isPending} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {batchUpdate.isPending ? "Opslaan..." : "Instellingen opslaan"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Embed Code</CardTitle>
            <CardDescription>
              Gebruik deze iframe-code op de website van de klant of op een aparte landingspagina.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <p className="text-sm text-muted-foreground">
              Laat alleen de reviewplatformen ingevuld die je effectief wilt tonen nadat iemand 4 of 5 sterren gaf. De slimme QR gebruikt dezelfde logica.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Placeholders</CardTitle>
          <CardDescription>
            Deze placeholders kun je gebruiken in alle teksten hieronder. Ze worden automatisch ingevuld op basis van de reviewaanvraag en gekozen score.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {REVIEW_TEXT_PLACEHOLDERS.map((placeholder) => (
            <code key={placeholder} className="rounded-full bg-muted px-3 py-1 text-xs">
              {placeholder}
            </code>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publieke Reviewflow Teksten</CardTitle>
            <CardDescription>
              Teksten voor de reviewlink die je rechtstreeks naar klanten stuurt. Dit is de hoofdflow voor reviewverzoeken per klant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {REVIEW_PUBLIC_TEXT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Textarea
                  value={textValues[field.key] ?? getReviewTextDefault(field.key)}
                  onChange={(event) => updateTextValue(field.key, event.target.value)}
                  rows={field.defaultValue.length > 120 ? 4 : 2}
                />
                <p className="text-xs text-muted-foreground">{field.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Embed Teksten</CardTitle>
            <CardDescription>
              Teksten voor de reviewwidget/embed op websites of QR-landingspagina&apos;s. De slimme QR gebruikt dezelfde embedflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {REVIEW_EMBED_TEXT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Textarea
                  value={textValues[field.key] ?? getReviewTextDefault(field.key)}
                  onChange={(event) => updateTextValue(field.key, event.target.value)}
                  rows={field.defaultValue.length > 120 ? 4 : 2}
                />
                <p className="text-xs text-muted-foreground">{field.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewQrCodeCard
          title="Slimme review QR"
          description="Deze QR opent dezelfde flow als je embed: eerst score, daarna pas doorgaan naar feedback of publieke review."
          url={standaloneReviewUrl}
          filename="review-flow-qr"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">QR Gebruik</CardTitle>
            <CardDescription>
              Gebruik de slimme QR op flyers, tafeltentjes, offertes of after-service mails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              De slimme QR is meestal de beste keuze: je vangt lagere scores eerst intern op en stuurt alleen tevreden klanten door naar publieke reviews.
            </p>
            <p>
              Voor campagnes die rechtstreeks naar een platform moeten gaan, kun je hieronder ook aparte platform QR-codes gebruiken.
            </p>
            <p>
              Tip: sla eerst je instellingen op als je nieuwe titels, kleuren of platformlinks wilt meenemen in de QR-codes.
            </p>
          </CardContent>
        </Card>
      </div>

      {platformQrCards.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {platformQrCards.map((item) => (
            <ReviewQrCodeCard
              key={item.key}
              title={item.label}
              description="Rechtstreekse QR naar het reviewplatform, zonder interne scorefilter."
              url={item.url}
              filename={`${item.key}-review-qr`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
