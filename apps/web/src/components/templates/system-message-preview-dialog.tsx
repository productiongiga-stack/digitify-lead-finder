"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@digitify/ui";
import { Pencil } from "lucide-react";
import { EmailPreview } from "@/components/email/preview";
import type { SystemMessageItem } from "@/components/templates/system-message-editor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: SystemMessageItem | null;
  onEdit: () => void;
  preview: {
    companyName: string;
    primaryColor: string;
    headerSlogan: string;
    masterShellHtml: string;
    signature: string;
    footer: string;
  };
};

export function SystemMessagePreviewDialog({
  open,
  onOpenChange,
  message,
  onEdit,
  preview,
}: Props) {
  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{message.name}</DialogTitle>
          <DialogDescription>{message.trigger}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Onderwerp: </span>
            <span className="font-medium">{message.subject || "—"}</span>
          </div>

          {message.placeholders.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {message.placeholders.map((key) => (
                <Badge key={key} variant="outline" className="font-mono text-[10px]">
                  {`{{${key}}}`}
                </Badge>
              ))}
            </div>
          ) : null}

          <EmailPreview
            subject={message.subject}
            body={message.body}
            bodyFormat={message.bodyFormat}
            companyName={preview.companyName}
            primaryColor={preview.primaryColor}
            fromName={preview.companyName}
            headerSlogan={preview.headerSlogan}
            recipientCompany="Voorbeeldbedrijf BV"
            masterShellHtml={preview.masterShellHtml}
            signature={preview.signature}
            footer={preview.footer}
            ctaText={message.ctaText || undefined}
            ctaUrl={message.ctaUrl || undefined}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Bewerken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
