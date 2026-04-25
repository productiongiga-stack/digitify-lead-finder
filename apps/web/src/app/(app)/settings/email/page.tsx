"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Skeleton,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tabs, TabsContent, TabsList, TabsTrigger, Badge,
} from "@digitify/ui";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";
import { readSettingString } from "@/lib/settings";
import { MailVariablesHelp } from "@/components/email/mail-variables-help";
import { EmailPreview } from "@/components/email/preview";
import { parseEmailLayout, type EmailLayout } from "@/lib/email-content";

const EMAIL_LAYOUT_OPTIONS: Array<{
  value: EmailLayout;
  label: string;
  description: string;
}> = [
  { value: "modern", label: "Modern", description: "Heldere allround layout voor algemene outreach." },
  { value: "minimal", label: "Minimalistisch", description: "Rustig en persoonlijk, ideaal voor korte mails." },
  { value: "business", label: "Zakelijk", description: "Strakker voor rapporten, afspraken en professionele updates." },
  { value: "proposal", label: "Voorstel", description: "Visueel sterker voor offertes en commerciële voorstellen." },
  { value: "followup", label: "Follow-up", description: "Compacte opvolg-layout voor reminders en check-ins." },
];

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
    || defaultLayout !== initialValues.defaultLayout;

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

      <div className="grid gap-3 xl:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Afzender</p>
            <p className="mt-2 text-sm font-medium">{fromName || "Geen afzendernaam"} · {fromEmail || "geen e-mail"}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layout</p>
            <p className="mt-2 text-sm font-medium">{EMAIL_LAYOUT_OPTIONS.find((layout) => layout.value === defaultLayout)?.label}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-up</p>
            <p className="mt-2 text-sm font-medium">Standaard na {followupDays || "3"} dagen</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/80 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wijzigingen</p>
            <p className="mt-2 text-sm font-medium">{hasChanges ? "Niet-opgeslagen wijzigingen aanwezig." : "Alles is opgeslagen."}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <Tabs defaultValue="identity" className="space-y-5">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="identity">Afzender</TabsTrigger>
              <TabsTrigger value="delivery">Verzending</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="variables">Variabelen</TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="space-y-4">
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

            <TabsContent value="delivery" className="space-y-4">
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

            <TabsContent value="design" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Premium compact maildesign</Badge>
                <p className="text-xs text-muted-foreground">
                  Elke layout gebruikt dezelfde premium basisstijl, maar met eigen inhoudsstructuur.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Standaard e-mail layout</Label>
                <Select value={defaultLayout} onValueChange={(value) => setDefaultLayout(parseEmailLayout(value, "business"))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_LAYOUT_OPTIONS.map((layout) => (
                      <SelectItem key={layout.value} value={layout.value}>
                        {layout.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {EMAIL_LAYOUT_OPTIONS.find((layout) => layout.value === defaultLayout)?.description}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {EMAIL_LAYOUT_OPTIONS.map((layout) => (
                  <button
                    key={layout.value}
                    type="button"
                    onClick={() => setDefaultLayout(layout.value)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      defaultLayout === layout.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-medium">{layout.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{layout.description}</p>
                  </button>
                ))}
              </div>
              <EmailPreview
                subject="Voorbeeld: samenwerking met {{companyName}}"
                body={[
                  "Beste {{contactName}},",
                  "",
                  "Bedankt voor je tijd. Hieronder vind je een helder overzicht met de volgende stap voor onze samenwerking.",
                  "",
                  "Alles is bewust compact gehouden zodat je snel kan scannen en reageren.",
                  "",
                  "Vriendelijke groeten,",
                  fromName || "Jouw naam",
                ].join("\n")}
                companyName={fromName || "Digitify"}
                primaryColor="#f5b04c"
                fromName={fromName || "Jouw naam"}
                headerSlogan={headerSlogan || "Premium outreach, helder en compact"}
                recipientCompany="Voorbeeldbedrijf BV"
                layout={defaultLayout}
              />
            </TabsContent>

            <TabsContent value="variables" className="space-y-4">
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
