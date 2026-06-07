"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { EmailDesignPanel } from "@/components/email/email-design-panel";
import { DEFAULT_MASTER_SHELL_HTML } from "@/lib/email-design-examples";
import type { EmailShellChecklistAction } from "@/lib/email-shell-branding";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";

export default function EmailSettingsPage() {
  const { data: settings, isLoading, error, refetch } = trpc.settings.getEmailSettings.useQuery(undefined, {
    retry: 1,
    ...SETTINGS_PAGE_QUERY_OPTS,
  });
  const { data: branding } = trpc.settings.getBranding.useQuery(undefined, SETTINGS_PAGE_QUERY_OPTS);
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getEmailSettings.invalidate();
      showToast({
        title: "E-mailinstellingen opgeslagen",
        description: "Afzender en master shell zijn bijgewerkt.",
      });
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const [fromTitle, setFromTitle] = useState("");
  const [headerSlogan, setHeaderSlogan] = useState("");
  const [signature, setSignature] = useState("");
  const [dailyLimit, setDailyLimit] = useState("50");
  const [followupDays, setFollowupDays] = useState("3");
  const [bcc, setBcc] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [footer, setFooter] = useState("");
  const [masterShellHtml, setMasterShellHtml] = useState(DEFAULT_MASTER_SHELL_HTML);
  const [activeTab, setActiveTab] = useState("identity");
  const [initialValues, setInitialValues] = useState({
    fromTitle: "",
    headerSlogan: "",
    signature: "",
    dailyLimit: "50",
    followupDays: "3",
    bcc: "",
    replyTo: "",
    footer: "",
    masterShellHtml: DEFAULT_MASTER_SHELL_HTML,
  });

  useEffect(() => {
    if (settings) {
      const legacyCustomHtml = readSettingString(settings, "email.custom_html", "");
      const nextValues = {
        fromTitle: readSettingString(settings, "email.from_title"),
        headerSlogan: readSettingString(settings, "email.header_slogan"),
        signature: readSettingString(settings, "email.signature"),
        dailyLimit: readSettingString(settings, "email.daily_limit", "50"),
        followupDays: readSettingString(settings, "email.followup_days", "3"),
        bcc: readSettingString(settings, "email.bcc"),
        replyTo: readSettingString(settings, "email.reply_to"),
        footer: readSettingString(settings, "email.footer"),
        masterShellHtml:
          readSettingString(settings, "email.master_shell_html", "")
          || legacyCustomHtml
          || DEFAULT_MASTER_SHELL_HTML,
      };
      setFromTitle(nextValues.fromTitle);
      setHeaderSlogan(nextValues.headerSlogan);
      setSignature(nextValues.signature);
      setDailyLimit(nextValues.dailyLimit);
      setFollowupDays(nextValues.followupDays);
      setBcc(nextValues.bcc);
      setReplyTo(nextValues.replyTo);
      setFooter(nextValues.footer);
      setMasterShellHtml(nextValues.masterShellHtml);
      setInitialValues(nextValues);
    }
  }, [settings]);

  function handleSave() {
    batchUpdate.mutate([
      { key: "email.from_title", value: fromTitle.trim() },
      { key: "email.header_slogan", value: headerSlogan },
      { key: "email.signature", value: signature },
      { key: "email.daily_limit", value: dailyLimit.trim() || "50" },
      { key: "email.followup_days", value: followupDays.trim() || "3" },
      { key: "email.bcc", value: bcc.trim() },
      { key: "email.reply_to", value: replyTo.trim() },
      { key: "email.footer", value: footer },
      { key: "email.master_shell_html", value: masterShellHtml },
    ]);
  }

  const senderName = readSettingString(branding || {}, "email.from_name");
  const senderEmail = readSettingString(branding || {}, "email.from_email");

  const hasChanges =
    fromTitle !== initialValues.fromTitle
    || headerSlogan !== initialValues.headerSlogan
    || signature !== initialValues.signature
    || dailyLimit !== initialValues.dailyLimit
    || followupDays !== initialValues.followupDays
    || bcc !== initialValues.bcc
    || replyTo !== initialValues.replyTo
    || footer !== initialValues.footer
    || masterShellHtml !== initialValues.masterShellHtml;

  const previewCompanyName = readSettingString(branding || settings || {}, "branding.company_name", "Digitify");
  const previewPrimaryColor = readSettingString(branding || settings || {}, "branding.primary_color", "#f9ae5a");
  const previewLogoUrl = readSettingString(branding || settings || {}, "branding.logo_url", "");

  const shellBranding = useMemo(
    () => ({
      companyName: previewCompanyName,
      primaryColor: previewPrimaryColor,
      logoUrl: previewLogoUrl || undefined,
      headerSlogan,
      fromName: senderName,
      fromEmail: senderEmail,
      fromTitle,
      signature,
      footer,
    }),
    [
      previewCompanyName,
      previewPrimaryColor,
      previewLogoUrl,
      headerSlogan,
      senderName,
      senderEmail,
      fromTitle,
      signature,
      footer,
    ],
  );

  const handleChecklistAction = useCallback((action: EmailShellChecklistAction, fieldId?: string) => {
    if (action.type !== "email-tab") return;
    setActiveTab(action.tab);
    window.setTimeout(() => {
      const field = fieldId ? document.getElementById(fieldId) : null;
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.focus();
      }
    }, 80);
  }, []);

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
          <h1 className="text-xl font-bold tracking-tight">Mail-opmaak</h1>
          <p className="text-sm text-muted-foreground">
            HTML-shell en branding voor alle mails. Berichtinhoud per module bewerk je onder{" "}
            <Link href="/templates" className="font-medium text-primary underline-offset-2 hover:underline">
              Standaard berichten
            </Link>
            .
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
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
                Mail-opmaak
              </TabsTrigger>
              <TabsTrigger value="variables" className="settings-domain-tab">
                <Braces className="settings-domain-tab-icon" />
                Variabelen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="mt-4 space-y-4">
              <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm">
                <p className="font-medium">Standaard afzender</p>
                <p className="mt-1 text-muted-foreground">
                  {senderName || "—"} &lt;{senderEmail || "—"}&gt;
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Afzendernaam en -adres beheer je centraal onder{" "}
                  <Link href="/settings/branding" className="font-medium text-primary underline-offset-2 hover:underline">
                    Branding & afzender
                  </Link>
                  , zodat mail, widgets en PDF&apos;s dezelfde identiteit gebruiken.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Functie / titel</Label>
                  <Input id="email-from-title" value={fromTitle} onChange={(e) => setFromTitle(e.target.value)} placeholder="Zaakvoerder" />
                </div>
                <div className="space-y-2">
                  <Label>Slogan onder titel</Label>
                  <Input id="email-header-slogan" value={headerSlogan} onChange={(e) => setHeaderSlogan(e.target.value)} placeholder="Digitale groei, helder uitgelegd" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Handtekening</Label>
                  <Textarea
                    id="email-signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Met vriendelijke groeten,&#10;Jan Janssen&#10;Mijn Bedrijf"
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail footer tekst</Label>
                  <Textarea
                    id="email-footer"
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
                masterShellHtml={masterShellHtml}
                onMasterShellHtmlChange={setMasterShellHtml}
                branding={shellBranding}
                onChecklistAction={handleChecklistAction}
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
