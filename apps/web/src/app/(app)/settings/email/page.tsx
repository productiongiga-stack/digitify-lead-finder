"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Button, Card, CardContent, Input, Label, Textarea, Skeleton,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@digitify/ui";
import { ArrowLeft, Save, Loader2, User, Send, Palette, Braces } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";
import { readSettingString } from "@/lib/settings";
import { MailVariablesHelp } from "@/components/email/mail-variables-help";
import { EmailDesignPanel, type EmailDesignMode } from "@/components/email/email-design-panel";
import { DEFAULT_CUSTOM_EMAIL_HTML } from "@/lib/email-design-examples";
import { parseEmailLayout, type EmailLayout, type TemplateType } from "@/lib/email-content";

type CustomHtmlPreset = {
  id: string;
  name: string;
  html: string;
};

const TYPE_LAYOUT_KEYS: TemplateType[] = [
  "OUTREACH",
  "FOLLOW_UP",
  "PROPOSAL",
  "REPORT",
  "BOOKING",
  "REVIEW",
  "REENGAGEMENT",
  "CUSTOM",
];

function parseDesignMode(value: string): EmailDesignMode {
  return value === "custom" ? "custom" : "preset";
}

function parseCustomHtmlPresets(value: string): CustomHtmlPreset[] {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id.trim() : "";
        const name = typeof record.name === "string" ? record.name.trim() : "";
        const html = typeof record.html === "string" ? record.html : "";
        if (!id || !name || !html.trim()) return null;
        return { id, name, html };
      })
      .filter((item): item is CustomHtmlPreset => item !== null);
  } catch {
    return [];
  }
}

function stringifyCustomHtmlPresets(value: CustomHtmlPreset[]) {
  return JSON.stringify(value, null, 2);
}

function parseLayoutByType(value: string): Partial<Record<TemplateType, EmailLayout>> {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const result: Partial<Record<TemplateType, EmailLayout>> = {};
    TYPE_LAYOUT_KEYS.forEach((typeKey) => {
      const raw = record[typeKey];
      if (typeof raw !== "string") return;
      const normalized = parseEmailLayout(raw, "business");
      result[typeKey] = normalized;
    });
    return result;
  } catch {
    return {};
  }
}

function stringifyLayoutByType(value: Partial<Record<TemplateType, EmailLayout>>) {
  return JSON.stringify(value, null, 2);
}

export default function EmailSettingsPage() {
  const { data: settings, isLoading, error, refetch } = trpc.settings.getAll.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      showToast({
        title: "E-mailinstellingen opgeslagen",
        description: "Afzender en layout zijn bijgewerkt.",
      });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromTitle, setFromTitle] = useState("");
  const [headerSlogan, setHeaderSlogan] = useState("");
  const [signature, setSignature] = useState("");
  const [dailyLimit, setDailyLimit] = useState("50");
  const [followupDays, setFollowupDays] = useState("3");
  const [bcc, setBcc] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [footer, setFooter] = useState("");
  const [defaultLayout, setDefaultLayout] = useState<EmailLayout>("business");
  const [designMode, setDesignMode] = useState<EmailDesignMode>("preset");
  const [customHtml, setCustomHtml] = useState(DEFAULT_CUSTOM_EMAIL_HTML);
  const [customHtmlPresets, setCustomHtmlPresets] = useState<CustomHtmlPreset[]>([]);
  const [layoutByType, setLayoutByType] = useState<Partial<Record<TemplateType, EmailLayout>>>({});
  const [initialValues, setInitialValues] = useState({
    fromName: "",
    fromEmail: "",
    fromTitle: "",
    headerSlogan: "",
    signature: "",
    dailyLimit: "50",
    followupDays: "3",
    bcc: "",
    replyTo: "",
    footer: "",
    defaultLayout: "business" as EmailLayout,
    designMode: "preset" as EmailDesignMode,
    customHtml: DEFAULT_CUSTOM_EMAIL_HTML,
    customHtmlPresets: [] as CustomHtmlPreset[],
    layoutByType: {} as Partial<Record<TemplateType, EmailLayout>>,
  });
  useEffect(() => {
    if (settings) {
      const nextValues = {
        fromName: readSettingString(settings, "email.from_name"),
        fromEmail: readSettingString(settings, "email.from_email"),
        fromTitle: readSettingString(settings, "email.from_title"),
        headerSlogan: readSettingString(settings, "email.header_slogan"),
        signature: readSettingString(settings, "email.signature"),
        dailyLimit: readSettingString(settings, "email.daily_limit", "50"),
        followupDays: readSettingString(settings, "email.followup_days", "3"),
        bcc: readSettingString(settings, "email.bcc"),
        replyTo: readSettingString(settings, "email.reply_to"),
        footer: readSettingString(settings, "email.footer"),
        defaultLayout: parseEmailLayout(readSettingString(settings, "email.default_layout", "business"), "business"),
        designMode: parseDesignMode(readSettingString(settings, "email.design_mode", "preset")),
        customHtml: readSettingString(settings, "email.custom_html", DEFAULT_CUSTOM_EMAIL_HTML) || DEFAULT_CUSTOM_EMAIL_HTML,
        customHtmlPresets: parseCustomHtmlPresets(
          readSettingString(settings, "email.custom_html_presets_json", "[]"),
        ),
        layoutByType: parseLayoutByType(
          readSettingString(settings, "email.default_layout_by_type_json", "{}"),
        ),
      };
      setFromName(nextValues.fromName);
      setFromEmail(nextValues.fromEmail);
      setFromTitle(nextValues.fromTitle);
      setHeaderSlogan(nextValues.headerSlogan);
      setSignature(nextValues.signature);
      setDailyLimit(nextValues.dailyLimit);
      setFollowupDays(nextValues.followupDays);
      setBcc(nextValues.bcc);
      setReplyTo(nextValues.replyTo);
      setFooter(nextValues.footer);
      setDefaultLayout(nextValues.defaultLayout);
      setDesignMode(nextValues.designMode);
      setCustomHtml(nextValues.customHtml);
      setCustomHtmlPresets(nextValues.customHtmlPresets);
      setLayoutByType(nextValues.layoutByType);
      setInitialValues(nextValues);
    }
  }, [settings]);

  function handleSave() {
    batchUpdate.mutate([
      { key: "email.from_name", value: fromName },
      { key: "email.from_email", value: fromEmail.trim() },
      { key: "email.from_title", value: fromTitle.trim() },
      { key: "email.header_slogan", value: headerSlogan },
      { key: "email.signature", value: signature },
      { key: "email.daily_limit", value: dailyLimit.trim() || "50" },
      { key: "email.followup_days", value: followupDays.trim() || "3" },
      { key: "email.bcc", value: bcc.trim() },
      { key: "email.reply_to", value: replyTo.trim() },
      { key: "email.footer", value: footer },
      { key: "email.default_layout", value: defaultLayout },
      { key: "email.design_mode", value: designMode },
      { key: "email.custom_html", value: customHtml },
      { key: "email.custom_html_presets_json", value: stringifyCustomHtmlPresets(customHtmlPresets) },
      { key: "email.default_layout_by_type_json", value: stringifyLayoutByType(layoutByType) },
    ]);
  }

  const hasChanges =
    fromName !== initialValues.fromName
    || fromEmail !== initialValues.fromEmail
    || fromTitle !== initialValues.fromTitle
    || headerSlogan !== initialValues.headerSlogan
    || signature !== initialValues.signature
    || dailyLimit !== initialValues.dailyLimit
    || followupDays !== initialValues.followupDays
    || bcc !== initialValues.bcc
    || replyTo !== initialValues.replyTo
    || footer !== initialValues.footer
    || defaultLayout !== initialValues.defaultLayout
    || designMode !== initialValues.designMode
    || customHtml !== initialValues.customHtml
    || JSON.stringify(customHtmlPresets) !== JSON.stringify(initialValues.customHtmlPresets)
    || JSON.stringify(layoutByType) !== JSON.stringify(initialValues.layoutByType);

  function saveCustomHtmlPreset(name: string) {
    const html = customHtml.trim();
    if (!html) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `preset-${Date.now()}`;
    setCustomHtmlPresets((current) => [{ id, name, html }, ...current].slice(0, 20));
    showToast({
      title: "Preset opgeslagen",
      description: `"${name}" is toegevoegd aan je HTML-presets.`,
    });
  }

  function loadCustomHtmlPreset(id: string) {
    const preset = customHtmlPresets.find((entry) => entry.id === id);
    if (!preset) return;
    setCustomHtml(preset.html);
    setDesignMode("custom");
  }

  function deleteCustomHtmlPreset(id: string) {
    setCustomHtmlPresets((current) => current.filter((entry) => entry.id !== id));
  }

  function setTypeLayout(type: TemplateType, layout: EmailLayout) {
    setLayoutByType((current) => ({
      ...current,
      [type]: layout,
    }));
  }

  const previewCompanyName = readSettingString(settings || {}, "branding.company_name", "Digitify");
  const previewPrimaryColor = readSettingString(settings || {}, "branding.primary_color", "#f9ae5a");

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">E-mailinstellingen konden niet geladen worden</p>
          <p className="mt-1 text-muted-foreground">{error.message}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
            Opnieuw proberen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">E-mail Instellingen</h1>
          <p className="text-sm text-muted-foreground">Configureer je e-mail afzender, handtekening en limieten</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <Tabs defaultValue="identity" className="space-y-5">
            <TabsList className="settings-domain-tabs settings-domain-tabs-cols-4 w-full">
              <TabsTrigger value="identity" className="settings-domain-tab">
                <User className="settings-domain-tab-icon" />
                Afzender
              </TabsTrigger>
              <TabsTrigger value="delivery" className="settings-domain-tab">
                <Send className="settings-domain-tab-icon" />
                Verzending
              </TabsTrigger>
              <TabsTrigger value="design" className="settings-domain-tab">
                <Palette className="settings-domain-tab-icon" />
                Design
              </TabsTrigger>
              <TabsTrigger value="variables" className="settings-domain-tab">
                <Braces className="settings-domain-tab-icon" />
                Variabelen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Standaard &quot;Van&quot; naam</Label>
                  <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Mijn Bedrijf" />
                </div>
                <div className="space-y-2">
                  <Label>Standaard &quot;Van&quot; e-mail</Label>
                  <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@mijnbedrijf.be" type="email" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Functie / titel</Label>
                  <Input value={fromTitle} onChange={(e) => setFromTitle(e.target.value)} placeholder="Zaakvoerder" />
                </div>
                <div className="space-y-2">
                  <Label>Slogan onder titel</Label>
                  <Input value={headerSlogan} onChange={(e) => setHeaderSlogan(e.target.value)} placeholder="Digitale groei, helder uitgelegd" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Handtekening</Label>
                  <Textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Met vriendelijke groeten,&#10;Jan Janssen&#10;Mijn Bedrijf"
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail footer tekst</Label>
                  <Textarea
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    placeholder="Mijn Bedrijf BV | Uw digitale partner | www.mijnbedrijf.be"
                    rows={5}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="delivery" className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reply-to adres (optioneel)</Label>
                  <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="reply@mijnbedrijf.be" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>BCC adres (optioneel, voor tracking)</Label>
                  <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc@mijnbedrijf.be" type="email" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Dagelijks verzendlimiet</Label>
                  <Input
                    type="number"
                    min="1"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Standaard follow-up interval (dagen)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={followupDays}
                    onChange={(e) => setFollowupDays(e.target.value)}
                    placeholder="3"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="design" className="mt-4 space-y-4">
              <EmailDesignPanel
                designMode={designMode}
                onDesignModeChange={setDesignMode}
                defaultLayout={defaultLayout}
                onDefaultLayoutChange={setDefaultLayout}
                layoutByType={layoutByType}
                onLayoutByTypeChange={setTypeLayout}
                customHtml={customHtml}
                onCustomHtmlChange={setCustomHtml}
                customPresets={customHtmlPresets.map((preset) => ({ id: preset.id, name: preset.name }))}
                onSavePreset={saveCustomHtmlPreset}
                onLoadPreset={loadCustomHtmlPreset}
                onDeletePreset={deleteCustomHtmlPreset}
                previewSubject="Voorbeeld: samenwerking met {{companyName}}"
                fromName={fromName}
                headerSlogan={headerSlogan}
                companyName={previewCompanyName}
                primaryColor={previewPrimaryColor}
              />
            </TabsContent>

            <TabsContent value="variables" className="mt-4 space-y-4">
              <MailVariablesHelp
                title="Centrale Variable Bibliotheek"
                defaultOpen={false}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={batchUpdate.isPending || !hasChanges}>
        {batchUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {batchUpdate.isPending ? "Opslaan..." : hasChanges ? "Opslaan" : "Alles opgeslagen"}
      </Button>
    </div>
  );
}
