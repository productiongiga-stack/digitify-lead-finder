"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@digitify/ui";
import Link from "next/link";
import { LayoutTemplate, Code2, Type } from "lucide-react";
import { EmailPreview } from "@/components/email/preview";
import { MailVariablesHelp } from "@/components/email/mail-variables-help";
import { useToast } from "@/components/feedback/toast-provider";
import type { EmailLayout, TemplateType } from "@/lib/email-content";
import { TEMPLATE_TYPES } from "@/lib/template-studio";
import { TemplateScopeHelp } from "@/components/templates/template-scope-help";

export type StudioForm = {
  id?: string;
  name: string;
  subject: string;
  body: string;
  bodyFormat: "TEXT" | "HTML";
  layout: EmailLayout;
  type: TemplateType;
  description: string;
  ctaText: string;
  ctaUrl: string;
  campaignId: string;
  isGlobal: boolean;
  isSystem?: boolean;
};

export const EMPTY_STUDIO_FORM: StudioForm = {
  name: "",
  subject: "",
  body: "",
  bodyFormat: "TEXT",
  layout: "modern",
  type: "OUTREACH",
  description: "",
  ctaText: "",
  ctaUrl: "",
  campaignId: "",
  isGlobal: false,
};

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#374151;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;">
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Beste {{contactName}},</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Plak hier je HTML-opmaak of pas deze template aan.</p>
        <p style="margin:0;font-size:16px;line-height:1.6;">{{senderName}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

type TemplateStudioEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: StudioForm;
  onFormChange: (form: StudioForm) => void;
  onSaved: () => void;
  previewCompanyName: string;
  previewPrimaryColor: string;
  previewHeaderSlogan: string;
  previewMasterShellHtml: string;
  previewSignature?: string;
  previewFooter?: string;
};

export function TemplateStudioEditor({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSaved,
  previewCompanyName,
  previewPrimaryColor,
  previewHeaderSlogan,
  previewMasterShellHtml,
  previewSignature = "",
  previewFooter = "",
}: TemplateStudioEditorProps) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const { data: campaignData } = trpc.campaign.list.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: open, staleTime: 120_000 },
  );
  const campaigns = campaignData?.items ?? [];

  const save = trpc.template.save.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      showToast({
        title: form.id ? "Template bijgewerkt" : "Template aangemaakt",
        description: "Je wijzigingen zijn opgeslagen in Template Studio.",
      });
      onSaved();
      onOpenChange(false);
    },
    onError: (error) => {
      showToast({
        title: "Opslaan mislukt",
        description: error.message,
        variant: "error",
      });
    },
  });

  const isValid = form.name.trim() && form.subject.trim() && form.body.trim();
  function insertVariable(key: string) {
    const token = form.bodyFormat === "HTML" ? `{{${key}}}` : `{{${key}}}`;
    onFormChange({ ...form, body: form.body ? `${form.body}${form.bodyFormat === "HTML" ? " " : "\n"}${token}` : token });
  }

  function setBodyFormat(next: "TEXT" | "HTML") {
    if (next === form.bodyFormat) return;
    if (next === "HTML") {
      onFormChange({
        ...form,
        bodyFormat: "HTML",
        body: form.body.trim() && !form.body.includes("<") ? `<p>${form.body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` : form.body.trim() || DEFAULT_HTML_TEMPLATE,
        ctaText: "",
        ctaUrl: "",
      });
      return;
    }
    onFormChange({
      ...form,
      bodyFormat: "TEXT",
      body: form.body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").trim() || "",
    });
  }

  function handleSave() {
    if (!isValid) return;
    save.mutate({
      id: form.id,
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body.trim(),
      bodyFormat: form.bodyFormat,
      layout: form.layout,
      type: form.type,
      description: form.description.trim() || undefined,
      ctaText: form.bodyFormat === "HTML" ? undefined : form.ctaText.trim() || undefined,
      ctaUrl: form.bodyFormat === "HTML" ? undefined : form.ctaUrl.trim() || undefined,
      campaignId: form.campaignId || null,
      isGlobal: form.isGlobal,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Template bewerken" : "Nieuw uniek template"}</DialogTitle>
          <DialogDescription>
            Bewerk onderwerp en inhoud. De mail-opmaak komt uit je master shell in Instellingen → E-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Mail-opmaak bewerken →{" "}
          <Link href="/settings/email" className="font-medium text-primary underline-offset-2 hover:underline">
            Instellingen → E-mail
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Naam</Label>
                <Input
                  value={form.name}
                  onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                  placeholder="Bijv. Intro premium outreach"
                  disabled={form.isSystem}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => onFormChange({ ...form, type: v as TemplateType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Korte beschrijving</Label>
              <Input
                value={form.description}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                placeholder="Waar gebruik je dit template voor?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Onderwerp</Label>
              <Input
                value={form.subject}
                onChange={(e) => onFormChange({ ...form, subject: e.target.value })}
                placeholder="Onderwerp met {{companyName}}..."
              />
            </div>

            <div className="space-y-2">
              <Label>Inhoudstype</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBodyFormat("TEXT")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-all ${
                    form.bodyFormat === "TEXT"
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                      : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <Type className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium">Tekst</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Inhoud in master shell</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBodyFormat("HTML")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-all ${
                    form.bodyFormat === "HTML"
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                      : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <Code2 className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium">Eigen HTML</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Plak en bekijk je opmaak</span>
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{form.bodyFormat === "HTML" ? "HTML code" : "Bericht"}</Label>
              <Textarea
                rows={form.bodyFormat === "HTML" ? 16 : 10}
                className="font-mono text-sm"
                value={form.body}
                onChange={(e) => onFormChange({ ...form, body: e.target.value })}
                placeholder={
                  form.bodyFormat === "HTML"
                    ? "<!DOCTYPE html>..."
                    : "Beste {{contactName}}, ..."
                }
              />
              {form.bodyFormat === "HTML" ? (
                <p className="text-xs text-muted-foreground">
                  Plak volledige HTML of een fragment. Placeholders zoals {"{{contactName}}"} werken ook in HTML.
                </p>
              ) : null}
            </div>

            {form.bodyFormat === "TEXT" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>CTA tekst (optioneel)</Label>
                <Input
                  value={form.ctaText}
                  onChange={(e) => onFormChange({ ...form, ctaText: e.target.value })}
                  placeholder="Plan een gesprek"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CTA URL (optioneel)</Label>
                <Input
                  value={form.ctaUrl}
                  onChange={(e) => onFormChange({ ...form, ctaUrl: e.target.value })}
                  placeholder="{{bookingLink}}"
                />
              </div>
            </div>
            ) : null}

            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <p className="text-sm font-medium">Zichtbaarheid in Outbound</p>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isGlobal}
                  onCheckedChange={(checked) =>
                    onFormChange({
                      ...form,
                      isGlobal: checked,
                      campaignId: checked ? "" : form.campaignId,
                    })
                  }
                />
                <div className="space-y-0.5">
                  <Label>Alle campagnes</Label>
                  <p className="text-xs text-muted-foreground">
                    Zichtbaar bij elke campagne-filter in compose — ongeacht gekoppelde campagne.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Campagne-label (optioneel)</Label>
                <Select
                  value={form.campaignId || "none"}
                  disabled={form.isGlobal}
                  onValueChange={(v) => onFormChange({ ...form, campaignId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Geen campagne" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen campagne</SelectItem>
                    {(campaigns ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.isGlobal
                    ? "Uitgeschakeld zolang “Alle campagnes” aan staat."
                    : "Alleen voor ordening in Studio; in compose telt vooral “Alle campagnes”."}
                </p>
              </div>
              <TemplateScopeHelp variant="studio" className="border-0 bg-transparent p-0 shadow-none" />
            </div>

            <MailVariablesHelp onInsert={insertVariable} defaultOpen />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{form.type}</Badge>
              {form.bodyFormat === "HTML" ? <Badge variant="secondary">HTML</Badge> : <Badge variant="secondary">Tekst</Badge>}
              {form.isSystem ? <Badge variant="outline">Systeem</Badge> : null}
              {form.ctaText ? <Badge>CTA</Badge> : null}
              {form.isGlobal ? <Badge variant="outline">Alle campagnes</Badge> : null}
            </div>
            <div className="sticky top-0 rounded-xl border bg-muted/20 p-3">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                <LayoutTemplate className="h-4 w-4" />
                Live preview — master shell
              </p>
              <EmailPreview
                subject={form.subject || "Voorbeeld onderwerp"}
                body={
                  form.body ||
                  (form.bodyFormat === "HTML"
                    ? DEFAULT_HTML_TEMPLATE
                    : "Beste {{contactName}},\n\nDit is je unieke template preview.\n\n{{senderName}}")
                }
                bodyFormat={form.bodyFormat}
                companyName={previewCompanyName}
                primaryColor={previewPrimaryColor}
                fromName={previewCompanyName}
                headerSlogan={previewHeaderSlogan}
                recipientCompany="Voorbeeldbedrijf BV"
                masterShellHtml={previewMasterShellHtml}
                signature={previewSignature}
                footer={previewFooter}
                ctaText={form.ctaText}
                ctaUrl={form.ctaUrl || "#"}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button type="button" onClick={handleSave} disabled={!isValid || save.isPending}>
            {save.isPending ? "Opslaan..." : form.id ? "Bijwerken" : "Template aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function templateToForm(template: {
  id: string;
  name: string;
  subject: string;
  cleanBody: string;
  bodyFormat?: string;
  layout: string;
  type: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  campaignId: string | null;
  isGlobal: boolean;
  isSystem?: boolean;
}): StudioForm {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.cleanBody,
    bodyFormat: template.bodyFormat === "HTML" ? "HTML" : "TEXT",
    layout: (template.layout as EmailLayout) || "modern",
    type: (template.type as TemplateType) || "CUSTOM",
    description: template.description || "",
    ctaText: template.ctaText || "",
    ctaUrl: template.ctaUrl || "",
    campaignId: template.campaignId || "",
    isGlobal: template.isGlobal,
    isSystem: template.isSystem ?? false,
  };
}

export function starterToForm(starter: {
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  layout: EmailLayout;
  bodyFormat?: "TEXT" | "HTML";
  description: string;
  ctaText?: string;
  ctaUrl?: string;
}): StudioForm {
  return {
    name: starter.name,
    subject: starter.subject,
    body: starter.body,
    bodyFormat: starter.bodyFormat === "HTML" ? "HTML" : "TEXT",
    layout: starter.layout,
    type: starter.type,
    description: starter.description,
    ctaText: starter.ctaText || "",
    ctaUrl: starter.ctaUrl || "",
    campaignId: "",
    isGlobal: false,
  };
}
