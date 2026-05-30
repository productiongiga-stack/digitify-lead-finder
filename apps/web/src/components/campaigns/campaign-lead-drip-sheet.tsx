"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@digitify/ui";
import { Check, Eye, EyeOff, FileEdit } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { OUTBOUND_STATUS_VARIANTS, getOutboundStatusLabel } from "@/lib/contact-status";
import { cn } from "@/lib/utils";
import type { CampaignLeadDraft, CampaignLeadRow } from "./campaign-leads-table";

type CampaignLeadDripSheetProps = {
  row: CampaignLeadRow | null;
  focusStep?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STEPS = [1, 2, 3] as const;

function getDraftForStep(drafts: CampaignLeadDraft[], step: number) {
  return drafts.find((d) => d.sequenceStep === step);
}

export function CampaignLeadDripSheet({ row, focusStep, open, onOpenChange }: CampaignLeadDripSheetProps) {
  const drafts = row?.emailDrafts ?? [];
  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open || !focusStep) return;
    const node = stepRefs.current[focusStep];
    if (!node) return;
    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open, focusStep, row?.leadId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{row?.companyName ?? "Drip"}</SheetTitle>
          <SheetDescription>
            Overzicht van de 3 drip-stappen, planning en open-tracking.
          </SheetDescription>
        </SheetHeader>
        {row ? (
          <div className="mt-6 space-y-4">
            {STEPS.map((step) => {
              const draft = getDraftForStep(drafts, step);

              return (
                <div
                  key={step}
                  ref={(node) => {
                    stepRefs.current[step] = node;
                  }}
                  className={cn(
                    "rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 transition-shadow",
                    focusStep === step && "border-primary/50 ring-2 ring-primary/25",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Stap {step}</p>
                    {draft ? (
                      <Badge variant={OUTBOUND_STATUS_VARIANTS[draft.status] ?? "secondary"}>
                        {getOutboundStatusLabel(draft.status, draft.scheduledFor)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Leeg</Badge>
                    )}
                  </div>
                  {draft ? (
                    <>
                      <p className="text-xs text-muted-foreground line-clamp-2">{draft.subject}</p>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        {draft.scheduledFor ? (
                          <>
                            <dt className="text-muted-foreground">Gepland</dt>
                            <dd>{formatDate(draft.scheduledFor)}</dd>
                          </>
                        ) : null}
                        {draft.sentAt ? (
                          <>
                            <dt className="text-muted-foreground">Verzonden</dt>
                            <dd>{formatDate(draft.sentAt)}</dd>
                          </>
                        ) : null}
                        {draft.sentAt ? (
                          <>
                            <dt className="text-muted-foreground">Geopend</dt>
                            <dd className="flex items-center gap-1">
                              {draft.openedAt ? (
                                <>
                                  <Eye className="h-3 w-3 text-emerald-600" />
                                  {formatDate(draft.openedAt)}
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                                  Nog niet geopend
                                </>
                              )}
                            </dd>
                          </>
                        ) : null}
                      </dl>
                      <Button asChild size="sm" variant="default" className="w-full">
                        <Link href={`/contacts/drafts/${draft.id}`}>
                          <FileEdit className="mr-2 h-3.5 w-3.5" />
                          Bekijken / bewerken in Outbound
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Gebruik &quot;Genereer stap 1–3&quot; op de campagne om deze stap aan te maken.
                    </p>
                  )}
                </div>
              );
            })}
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/leads/${row.leadId}`}>
                <Check className="mr-2 h-4 w-4" />
                Leadprofiel openen
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
