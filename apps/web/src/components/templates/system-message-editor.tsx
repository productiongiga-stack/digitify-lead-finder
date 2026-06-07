"use client";

import { useEffect, useState } from "react";
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
  Textarea,
} from "@digitify/ui";
import { Loader2, Save } from "lucide-react";
import { EmailPreview } from "@/components/email/preview";
import { MailVariablesHelp } from "@/components/email/mail-variables-help";
import { useToast } from "@/components/feedback/toast-provider";

export type SystemMessageItem = {
  templateKey: string;
  name: string;
  description: string;
  trigger: string;
  placeholders: string[];
  subject: string;
  body: string;
  bodyFormat: "TEXT" | "HTML";
  ctaText: string;
  ctaUrl: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: SystemMessageItem | null;
  onSaved: () => void;
  preview: {
    companyName: string;
    primaryColor: string;
    headerSlogan: string;
    masterShellHtml: string;
    signature: string;
    footer: string;
  };
};

export function SystemMessageEditor({
  open,
  onOpenChange,
  message,
  onSaved,
  preview,
}: Props) {
  const { showToast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  useEffect(() => {
    if (!message) return;
    setSubject(message.subject);
    setBody(message.body);
    setCtaText(message.ctaText);
    setCtaUrl(message.ctaUrl);
  }, [message]);

  const save = trpc.template.updateSystemMessage.useMutation({
    onSuccess: () => {
      showToast({ title: "Bericht opgeslagen" });
      onSaved();
      onOpenChange(false);
    },
    onError: (error) =>
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{message.name}</DialogTitle>
          <DialogDescription>
            {message.trigger}
            {message.description ? ` — ${message.description}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {message.placeholders.map((key) => (
                <Badge key={key} variant="outline" className="font-mono text-[11px]">
                  {`{{${key}}}`}
                </Badge>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sys-subject">Onderwerp</Label>
              <Input
                id="sys-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sys-body">Inhoud</Label>
              <Textarea
                id="sys-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={14}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sys-cta-text">CTA-tekst (optioneel)</Label>
                <Input
                  id="sys-cta-text"
                  value={ctaText}
                  onChange={(event) => setCtaText(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sys-cta-url">CTA-link (optioneel)</Label>
                <Input
                  id="sys-cta-url"
                  value={ctaUrl}
                  onChange={(event) => setCtaUrl(event.target.value)}
                />
              </div>
            </div>

            <MailVariablesHelp />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Preview (workspace mail-opmaak)</p>
            <EmailPreview
              subject={subject}
              body={body}
              bodyFormat={message.bodyFormat}
              companyName={preview.companyName}
              primaryColor={preview.primaryColor}
              fromName="Digitify"
              headerSlogan={preview.headerSlogan}
              recipientCompany="Voorbeeldbedrijf BV"
              masterShellHtml={preview.masterShellHtml}
              signature={preview.signature}
              footer={preview.footer}
              ctaText={ctaText || undefined}
              ctaUrl={ctaUrl || undefined}
              compact
              showMeta={false}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            disabled={save.isPending || !subject.trim() || !body.trim()}
            onClick={() =>
              save.mutate({
                templateKey: message.templateKey,
                subject,
                body,
                bodyFormat: message.bodyFormat,
                ctaText: ctaText || undefined,
                ctaUrl: ctaUrl || undefined,
              })
            }
          >
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
