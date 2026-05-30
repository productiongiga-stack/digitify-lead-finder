"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@digitify/ui";
import {
  Check,
  ExternalLink,
  FileEdit,
  Globe,
  Mail,
  MoreHorizontal,
  UserMinus,
  UserPlus,
  Users,
  Eye,
} from "lucide-react";
import { cn, formatDate, formatScore, getScoreColor } from "@/lib/utils";
import { getLeadStatusLabel, getLeadStatusBadgeVariant } from "@/lib/lead-status";
import {
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_VARIANTS,
  getOutboundStatusForDisplay,
  getOutboundStatusLabel,
} from "@/lib/contact-status";
import { CampaignLeadDripSheet } from "./campaign-lead-drip-sheet";

export type CampaignLeadDraft = {
  id: string;
  sequenceStep: number;
  status: string;
  subject?: string;
  scheduledFor?: Date | string | null;
  sentAt?: Date | string | null;
  openedAt?: Date | string | null;
};

export type CampaignLeadRow = {
  leadId: string;
  companyName: string;
  email?: string | null;
  city?: string | null;
  website?: string | null;
  overallScore?: number | null;
  status: string;
  addedAt: Date | string;
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  emailDrafts?: CampaignLeadDraft[];
};

type CampaignLeadsTableProps = {
  leads: CampaignLeadRow[];
  audienceTitle?: string;
  addButtonLabel?: string;
  onAddLeads: () => void;
  onRemoveLead: (leadId: string) => void;
  removing?: boolean;
};

const DRIP_STEPS = [1, 2, 3] as const;

function getDraftForStep(drafts: CampaignLeadDraft[], step: number) {
  return drafts.find((d) => d.sequenceStep === step);
}

function getStepNodeClass(draft: CampaignLeadDraft | undefined) {
  if (!draft) {
    return "border-muted-foreground/25 bg-muted/40 text-muted-foreground";
  }
  if (draft.status === "SENT") {
    return "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (draft.status === "FAILED" || draft.status === "BOUNCED") {
    return "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300";
  }
  if (draft.status === "APPROVED") {
    return "border-blue-500/50 bg-blue-500/15 text-blue-700 dark:text-blue-300";
  }
  if (draft.status === "SCHEDULED") {
    return "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }
  return "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200";
}

function DripStepBall({
  step,
  draft,
  active,
  showConnector,
  connectorSent,
  onSelect,
  onOpenSheet,
}: {
  step: number;
  draft: CampaignLeadDraft | undefined;
  active: boolean;
  showConnector: boolean;
  connectorSent: boolean;
  onSelect: (step: number) => void;
  onOpenSheet: (step: number) => void;
}) {
  const sent = draft?.status === "SENT";
  const displayStatus = draft ? getOutboundStatusForDisplay(draft.status) : null;

  return (
    <div className="flex items-center">
      {showConnector ? (
        <span
          className={cn(
            "mx-0.5 h-px w-2 sm:w-3",
            connectorSent ? "bg-emerald-500/60" : "bg-border",
          )}
          aria-hidden
        />
      ) : null}
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) onSelect(step);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Drip stap ${step}${draft ? `: ${getOutboundStatusLabel(draft.status, draft.scheduledFor)}` : ""}`}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-colors",
              "cursor-pointer hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active && "ring-2 ring-primary/50",
              getStepNodeClass(draft),
            )}
          >
            {sent ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : step}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-semibold">Drip stap {step}</DropdownMenuLabel>
          {draft ? (
            <>
              <div className="space-y-1.5 px-2 pb-2">
                <Badge
                  variant={OUTBOUND_STATUS_VARIANTS[displayStatus!] ?? "secondary"}
                  className="text-[10px] font-medium"
                >
                  {getOutboundStatusLabel(draft.status, draft.scheduledFor)}
                </Badge>
                {draft.subject ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{draft.subject}</p>
                ) : null}
                {draft.scheduledFor ? (
                  <p className="text-[11px] text-muted-foreground">
                    Gepland: {formatDate(draft.scheduledFor)}
                  </p>
                ) : null}
                {draft.sentAt ? (
                  <p className="text-[11px] text-muted-foreground">
                    Verzonden: {formatDate(draft.sentAt)}
                    {draft.openedAt ? ` · geopend ${formatDate(draft.openedAt)}` : ""}
                  </p>
                ) : null}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/contacts/drafts/${draft.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Bekijken in Outbound
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/contacts/drafts/${draft.id}`}>
                  <FileEdit className="mr-2 h-4 w-4" />
                  Bewerken in Outbound
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenSheet(step)}>
                <Mail className="mr-2 h-4 w-4" />
                Volledig drip-overzicht
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <div className="px-2 pb-2 text-xs text-muted-foreground">
                Deze stap is nog niet aangemaakt. Genereer de drip op het campagneprofiel.
              </div>
              <DropdownMenuItem onClick={() => onOpenSheet(step)}>
                <Mail className="mr-2 h-4 w-4" />
                Drip-overzicht openen
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DripSequenceProgress({
  drafts,
  onSetupDrip,
  onOpenStepSheet,
}: {
  drafts: CampaignLeadDraft[];
  onSetupDrip?: () => void;
  onOpenStepSheet?: (step: number) => void;
}) {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  if (drafts.length === 0) {
    return (
      <button
        type="button"
        onClick={onSetupDrip}
        className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Drip instellen…
      </button>
    );
  }

  const primaryDraft =
    drafts.find((d) => d.status === "DRAFT" || d.status === "PENDING_APPROVAL" || d.status === "SCHEDULED") ??
    drafts.find((d) => d.status !== "SENT") ??
    drafts[0];
  const focusedDraft = activeStep ? getDraftForStep(drafts, activeStep) : undefined;
  const summaryDraft = focusedDraft ?? primaryDraft;
  const summaryStep = activeStep ?? summaryDraft?.sequenceStep;
  const sentCount = drafts.filter((d) => d.status === "SENT").length;
  const openedCount = drafts.filter((d) => d.openedAt).length;

  return (
    <div className="min-w-[140px] space-y-2 rounded-lg p-1 -m-1">
      <div className="flex items-center gap-0.5">
        {DRIP_STEPS.map((step, index) => {
          const draft = getDraftForStep(drafts, step);
          const prevSent = index > 0 && getDraftForStep(drafts, DRIP_STEPS[index - 1])?.status === "SENT";
          return (
            <DripStepBall
              key={step}
              step={step}
              draft={draft}
              active={activeStep === step}
              showConnector={index > 0}
              connectorSent={Boolean(draft?.status === "SENT" || prevSent)}
              onSelect={setActiveStep}
              onOpenSheet={(s) => onOpenStepSheet?.(s)}
            />
          );
        })}
      </div>
      {summaryDraft && summaryStep ? (
        <Link
          href={`/contacts/drafts/${summaryDraft.id}`}
          className="flex flex-wrap items-center gap-1.5 rounded-md transition-colors hover:bg-muted/50"
        >
          <Badge
            variant={OUTBOUND_STATUS_VARIANTS[getOutboundStatusForDisplay(summaryDraft.status)] ?? "secondary"}
            className="text-[10px] font-medium"
          >
            {getOutboundStatusLabel(summaryDraft.status, summaryDraft.scheduledFor)}
          </Badge>
          <span className="text-[11px] text-muted-foreground">Stap {summaryStep}</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground/70" />
        </Link>
      ) : activeStep ? (
        <button
          type="button"
          onClick={() => onOpenStepSheet?.(activeStep)}
          className="text-left text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Stap {activeStep} — nog geen mail
        </button>
      ) : null}
      {sentCount > 0 ? (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Eye className="h-3 w-3" />
          {openedCount}/{sentCount} geopend
        </p>
      ) : null}
    </div>
  );
}

function CampaignLeadTableRow({
  row,
  onRemoveLead,
  onOpenDrip,
  removing,
}: {
  row: CampaignLeadRow;
  onRemoveLead: (leadId: string) => void;
  onOpenDrip: (step?: number) => void;
  removing?: boolean;
}) {
  const drafts = row.emailDrafts ?? [];
  const primaryDraft =
    drafts.find((d) => d.status === "DRAFT" || d.status === "PENDING_APPROVAL") ?? drafts[0];
  const score = row.overallScore;
  const scoreLabel = formatScore(score);
  const subtitle = row.email ?? row.city ?? null;

  return (
    <TableRow className="group hover:bg-muted/40">
      <TableCell className="min-w-[200px] py-3">
        <Link
          href={`/leads/${row.leadId}`}
          className="font-semibold leading-snug text-foreground hover:text-primary"
        >
          {row.companyName}
        </Link>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        {row.tags && row.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {row.tags.map((lt) => (
              <Badge
                key={lt.tag.id}
                variant="outline"
                className="px-1.5 py-0 text-[10px] font-normal"
                style={{
                  borderColor: lt.tag.color,
                  color: lt.tag.color,
                }}
              >
                {lt.tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="w-[72px] py-3">
        <span
          className={cn(
            "inline-flex min-w-[2.5rem] items-center justify-center rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-sm font-bold tabular-nums",
            score != null ? getScoreColor(score) : "text-muted-foreground",
          )}
        >
          {scoreLabel}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <Badge variant={getLeadStatusBadgeVariant(row.status)} className="font-normal">
          {getLeadStatusLabel(row.status)}
        </Badge>
      </TableCell>
      <TableCell className="py-3">
        <DripSequenceProgress
          drafts={drafts}
          onSetupDrip={() => onOpenDrip()}
          onOpenStepSheet={(step) => onOpenDrip(step)}
        />
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
                  row.website
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-border/60 bg-muted/30 text-muted-foreground/50",
                )}
              >
                <Globe className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{row.website ? "Website bekend" : "Geen website"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
                  row.email
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-border/60 bg-muted/30 text-muted-foreground/50",
                )}
              >
                <Mail className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{row.email ? row.email : "Geen e-mail"}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
      <TableCell className="hidden py-3 text-sm text-muted-foreground md:table-cell">
        {formatDate(row.addedAt)}
      </TableCell>
      <TableCell className="py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {primaryDraft ? (
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 shadow-sm">
              <Link href={`/contacts/drafts/${primaryDraft.id}`}>
                <FileEdit className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Draft</span>
              </Link>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Meer acties</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/leads/${row.leadId}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Lead openen
                </Link>
              </DropdownMenuItem>
              {primaryDraft ? (
                <DropdownMenuItem asChild>
                  <Link href={`/contacts/drafts/${primaryDraft.id}`}>
                    <FileEdit className="mr-2 h-4 w-4" />
                    Open in Outbound
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => onOpenDrip()}>
                <Mail className="mr-2 h-4 w-4" />
                Drip-overzicht
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={removing}
                onClick={() => onRemoveLead(row.leadId)}
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Uit campagne
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CampaignLeadsTable({
  leads,
  audienceTitle = "Leads in dit profiel",
  addButtonLabel = "Contacten toevoegen",
  onAddLeads,
  onRemoveLead,
  removing,
}: CampaignLeadsTableProps) {
  const [dripRow, setDripRow] = useState<CampaignLeadRow | null>(null);
  const [dripFocusStep, setDripFocusStep] = useState<number | undefined>(undefined);

  return (
    <TooltipProvider delayDuration={300}>
      <CampaignLeadDripSheet
        row={dripRow}
        focusStep={dripFocusStep}
        open={dripRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDripRow(null);
            setDripFocusStep(undefined);
          }
        }}
      />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">{audienceTitle}</CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {leads.length}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onAddLeads}>
              <UserPlus className="mr-2 h-4 w-4" />
              {addButtonLabel}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 py-12 text-center">
              <Users className="h-9 w-9 text-muted-foreground/35" />
              <p className="mt-3 text-sm font-medium">Nog geen leads</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Voeg leads toe om de drip te starten en follow-ups te plannen.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onAddLeads}>
                <UserPlus className="mr-2 h-3.5 w-3.5" />
                {addButtonLabel}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10">Bedrijf</TableHead>
                    <TableHead className="h-10 w-[72px]">Score</TableHead>
                    <TableHead className="h-10">Status</TableHead>
                    <TableHead className="h-10 min-w-[160px]">Drip</TableHead>
                    <TableHead className="h-10 w-[88px]">Contact</TableHead>
                    <TableHead className="hidden h-10 md:table-cell">Toegevoegd</TableHead>
                    <TableHead className="h-10 w-[120px] text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((row) => (
                    <CampaignLeadTableRow
                      key={row.leadId}
                      row={row}
                      onRemoveLead={onRemoveLead}
                      onOpenDrip={(step) => {
                        setDripRow(row);
                        setDripFocusStep(step);
                      }}
                      removing={removing}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
