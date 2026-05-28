"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { ArrowLeft, Save, Loader2, Upload, X, Image, Zap, CheckCircle2, Sparkles, Eye, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";

export default function BrandingSettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const updateSetting = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.getAll.invalidate(),
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      setInitialValues({ companyName, companySlogan, primaryColor, fromName, fromEmail });
      setShowSuccess(true);
      showToast({ title: "Branding opgeslagen", description: "Je branding is bijgewerkt voor dit account." });
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const [companyName, setCompanyName] = useState("");
  const [companySlogan, setCompanySlogan] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#f9ae5a");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [initialValues, setInitialValues] = useState({
    companyName: "",
    companySlogan: "",
    primaryColor: "#f9ae5a",
    fromName: "",
    fromEmail: "",
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Load settings into state once
  useEffect(() => {
    if (settings && !loaded) {
      const get = (key: string, fallback = ""): string => {
        const val = settings[key];
        if (val === null || val === undefined) return fallback;
        try {
          const parsed = typeof val === "string" ? JSON.parse(val) : val;
          return String(parsed);
        } catch {
          return String(val);
        }
      };
      setCompanyName(get("branding.company_name"));
      setCompanySlogan(get("branding.company_slogan"));
      setPrimaryColor(get("branding.primary_color", "#f9ae5a"));
      setFromName(get("email.from_name"));
      setFromEmail(get("email.from_email"));
      setLogoUrl(get("branding.logo_url"));
      setFaviconUrl(get("branding.favicon_url"));
      setInitialValues({
        companyName: get("branding.company_name"),
        companySlogan: get("branding.company_slogan"),
        primaryColor: get("branding.primary_color", "#f9ae5a"),
        fromName: get("email.from_name"),
        fromEmail: get("email.from_email"),
      });
      setLoaded(true);
    }
  }, [settings, loaded]);

  async function handleUpload(type: "logo" | "favicon", file: File) {
    setUploading(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        showToast({ title: "Upload mislukt", description: data.error || "Upload mislukt", variant: "error" });
        return;
      }

      const key = type === "logo" ? "branding.logo_url" : "branding.favicon_url";
      await updateSetting.mutateAsync({ key, value: data.url });

      if (type === "logo") setLogoUrl(data.url);
      else setFaviconUrl(data.url);
      showToast({
        title: type === "logo" ? "Logo bijgewerkt" : "Favicon bijgewerkt",
        description: "De branding-afbeelding is opgeslagen.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      showToast({
        title: "Upload mislukt",
        description: message || "Kon het bestand niet opslaan.",
        variant: "error",
      });
    } finally {
      setUploading(null);
    }
  }

  function handleRemoveLogo() {
    updateSetting.mutate({ key: "branding.logo_url", value: "" });
    setLogoUrl("");
  }

  function handleRemoveFavicon() {
    updateSetting.mutate({ key: "branding.favicon_url", value: "" });
    setFaviconUrl("");
  }

  function handleSave() {
    batchUpdate.mutate([
      { key: "branding.company_name", value: companyName },
      { key: "branding.company_slogan", value: companySlogan },
      { key: "branding.primary_color", value: primaryColor },
      { key: "email.from_name", value: fromName },
      { key: "email.from_email", value: fromEmail },
    ]);
  }

  const hasChanges = loaded && (
    companyName !== initialValues.companyName
    || companySlogan !== initialValues.companySlogan
    || primaryColor !== initialValues.primaryColor
    || fromName !== initialValues.fromName
    || fromEmail !== initialValues.fromEmail
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Branding</h1>
          <p className="text-sm text-muted-foreground">Pas je huisstijl en e-mail afzender aan</p>
        </div>
      </div>

      <div className={`branding-save-bar ${hasChanges ? "" : "border-emerald-500/20"}`}>
        <div className={hasChanges ? "branding-save-bar-accent" : "branding-save-bar-accent-saved"} />
        <div className="branding-save-bar-content">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`branding-save-bar-icon ${hasChanges ? "branding-save-bar-icon-dirty" : "branding-save-bar-icon-saved"}`}>
              {hasChanges ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">
                {hasChanges ? "Niet-opgeslagen wijzigingen" : "Alles is opgeslagen"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hasChanges
                  ? "Sla je aanpassingen op voordat je de pagina verlaat."
                  : "Pas logo, kleuren en e-mailafzender aan en bekijk direct de preview."}
              </p>
            </div>
          </div>
          {hasChanges || batchUpdate.isPending ? (
            <Button
              onClick={handleSave}
              disabled={batchUpdate.isPending}
              className="shrink-0 shadow-sm"
            >
              {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {batchUpdate.isPending ? "Opslaan..." : "Wijzigingen opslaan"}
            </Button>
          ) : (
            <Badge variant="secondary" className="shrink-0 gap-1.5 px-3 py-1.5 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Up-to-date
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <Tabs defaultValue="identity" className="space-y-5">
            <TabsList className="settings-domain-tabs settings-domain-tabs-cols-3 w-full">
              <TabsTrigger value="identity" className="settings-domain-tab">
                <Sparkles className="settings-domain-tab-icon" aria-hidden />
                <span>Identiteit</span>
              </TabsTrigger>
              <TabsTrigger value="assets" className="settings-domain-tab">
                <Image className="settings-domain-tab-icon" aria-hidden />
                <span>Assets</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="settings-domain-tab">
                <Eye className="settings-domain-tab-icon" aria-hidden />
                <span>Preview</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-sm">Huisstijl</CardTitle>
                    <CardDescription className="text-xs">Kern van je merkidentiteit binnen de app.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Bedrijfsnaam</Label>
                      <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Slogan onder titel</Label>
                      <Input
                        value={companySlogan}
                        onChange={(e) => setCompanySlogan(e.target.value)}
                        placeholder="Digitale groei, helder uitgelegd"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primaire kleur</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-9 w-9 cursor-pointer rounded border"
                        />
                        <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Kleur voorbeeld</Label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Voorbeeld knop
                        </button>
                        <span className="text-sm font-medium" style={{ color: primaryColor }}>
                          Tekst in primaire kleur
                        </span>
                        <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: primaryColor }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-sm">E-mail Afzender</CardTitle>
                    <CardDescription className="text-xs">Deze basisgegevens worden mee gebruikt in e-mails en widgets.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Afzendernaam</Label>
                      <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Mijn Bedrijf" />
                    </div>
                    <div className="space-y-2">
                      <Label>Afzender e-mail</Label>
                      <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@mijnbedrijf.be" />
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                      Wijzig je hier je afzender, dan voelt de app visueel en communicatief consistenter aan over mail, sidebar en publieke flows.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assets" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-sm">Logo</CardTitle>
                    <CardDescription className="text-xs">PNG, JPG, SVG of WebP, max 2MB.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {logoUrl ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 rounded-lg border p-4">
                          <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded object-contain" />
                          <span className="text-sm text-muted-foreground">Huidig logo</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRemoveLogo}>
                          <X className="mr-1.5 h-3.5 w-3.5" /> Verwijderen
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 rounded-lg border border-dashed p-6">
                        <Image className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Geen logo ingesteld</p>
                          <p className="text-xs text-muted-foreground">Het standaard icoon wordt gebruikt</p>
                        </div>
                      </div>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload("logo", file);
                        e.target.value = "";
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploading === "logo"}>
                      {uploading === "logo" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      Logo uploaden
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-sm">Favicon</CardTitle>
                    <CardDescription className="text-xs">PNG, ICO of SVG, max 2MB.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {faviconUrl ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 rounded-lg border p-4">
                          <img src={faviconUrl} alt="Favicon" className="h-8 w-8 rounded object-contain" />
                          <span className="text-sm text-muted-foreground">Huidig favicon</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRemoveFavicon}>
                          <X className="mr-1.5 h-3.5 w-3.5" /> Verwijderen
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 rounded-lg border border-dashed p-6">
                        <Zap className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Geen favicon ingesteld</p>
                          <p className="text-xs text-muted-foreground">Het standaard favicon wordt gebruikt</p>
                        </div>
                      </div>
                    )}
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/png,image/x-icon,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload("favicon", file);
                        e.target.value = "";
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()} disabled={uploading === "favicon"}>
                      {uploading === "favicon" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      Favicon uploaden
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Live preview</Badge>
                <p className="text-xs text-muted-foreground">Controleer meteen hoe je merk in de app-shell zal ogen.</p>
              </div>
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-sm">Sidebar Voorbeeld</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-xs rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      {logoUrl ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                          <img src={logoUrl} alt="Logo" className="h-9 w-9 object-contain" />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>
                          {(companyName || "D").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-lg font-bold tracking-tight">{companyName || "Mijn Bedrijf"}</p>
                        {companySlogan ? <p className="text-xs text-muted-foreground">{companySlogan}</p> : null}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {["Dashboard", "Leads", "Offertes", "Instellingen"].map((item) => (
                        <div
                          key={item}
                          className={`rounded-md px-3 py-1.5 text-sm ${item === "Dashboard" ? "font-medium text-white" : "text-muted-foreground"}`}
                          style={item === "Dashboard" ? { backgroundColor: primaryColor } : {}}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={batchUpdate.isPending || !hasChanges}>
          {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {batchUpdate.isPending ? "Opslaan..." : "Opslaan"}
        </Button>
        {showSuccess && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            <span>Branding instellingen opgeslagen</span>
          </div>
        )}
      </div>
    </div>
  );
}
