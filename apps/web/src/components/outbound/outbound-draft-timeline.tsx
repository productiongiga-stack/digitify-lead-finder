"use client";

import { XCircle } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  OUTBOUND_TIMELINE_STEPS,
  getOutboundTimelineStatus,
} from "@/lib/contact-status";

type OutboundDraftTimelineProps = {
  status: string;
  createdAt: Date | string;
  approvedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  sentAt?: Date | string | null;
};

const STEP_TONES = ["slate", "sky", "amber", "emerald"] as const;

function getStepTimestamp(
  index: number,
  draft: OutboundDraftTimelineProps,
  rejected: boolean,
): string | null {
  if (index === 0) return formatDate(draft.createdAt);
  if (index === 2 && rejected && draft.rejectedAt) return formatDate(draft.rejectedAt);
  if (index === 2 && !rejected && draft.approvedAt) return formatDate(draft.approvedAt);
  if (index === 3 && draft.sentAt) return formatDate(draft.sentAt);
  return null;
}

function getStepLabel(
  index: number,
  stepLabel: string,
  rejected: boolean,
  status: string,
): string {
  if (index === 2 && rejected) return "Afgekeurd";
  if (index === 3 && status === "FAILED") return "Mislukt";
  if (index === 3 && status === "BOUNCED") return "Bounced";
  if (index === 3 && status === "SENDING") return "Verzenden…";
  return stepLabel;
}

function getStepState(
  index: number,
  activeIndex: number,
  rejected: boolean,
  status: string,
): "complete" | "current" | "upcoming" | "error" {
  if (index === 2 && rejected) return "error";
  if (index === 3 && (status === "FAILED" || status === "BOUNCED") && index === activeIndex) {
    return "error";
  }
  if (index < activeIndex) return "complete";
  if (index === activeIndex) return "current";
  return "upcoming";
}

export function OutboundDraftTimeline({
  status,
  createdAt,
  approvedAt,
  rejectedAt,
  sentAt,
}: OutboundDraftTimelineProps) {
  const draft = { status, createdAt, approvedAt, rejectedAt, sentAt };
  const { activeIndex, rejected } = getOutboundTimelineStatus(status);
  const isSending = status === "SENDING";

  return (
    <div className="outbound-draft-timeline overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-sm">
      <div className="outbound-draft-timeline-glow" aria-hidden="true" />
      <div className="relative p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Outbound voortgang
          </p>
          <p className="text-xs text-muted-foreground">
            Stap {Math.min(activeIndex + 1, OUTBOUND_TIMELINE_STEPS.length)} van{" "}
            {OUTBOUND_TIMELINE_STEPS.length}
          </p>
        </div>

        <div className="outbound-draft-timeline-track">
          {OUTBOUND_TIMELINE_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const stepState = getStepState(index, activeIndex, rejected, status);
            const tone = STEP_TONES[index] ?? "slate";
            const timestamp = getStepTimestamp(index, draft, rejected);
            const label = getStepLabel(index, step.label, rejected, status);
            const connectorActive = index < activeIndex && !(index === 1 && rejected);
            const connectorError =
              (index === 1 && rejected) || (index === 2 && (status === "FAILED" || status === "BOUNCED"));

            return (
              <div key={step.key} className="contents">
                <div
                  className={cn(
                    "outbound-draft-timeline-step",
                    `outbound-draft-timeline-step-${tone}`,
                    stepState === "current" && "outbound-draft-timeline-step-current",
                    stepState === "complete" && "outbound-draft-timeline-step-complete",
                    stepState === "upcoming" && "outbound-draft-timeline-step-upcoming",
                    stepState === "error" && "outbound-draft-timeline-step-error",
                    isSending && index === 3 && stepState === "current" && "outbound-draft-timeline-step-pulse",
                  )}
                >
                  <div className="outbound-draft-timeline-step-node">
                    {stepState === "error" ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="outbound-draft-timeline-step-copy">
                    <p className="outbound-draft-timeline-step-label">{label}</p>
                    {timestamp ? (
                      <p className="outbound-draft-timeline-step-time">{timestamp}</p>
                    ) : (
                      <p className="outbound-draft-timeline-step-time outbound-draft-timeline-step-time-empty">
                        —
                      </p>
                    )}
                  </div>
                </div>

                {index < OUTBOUND_TIMELINE_STEPS.length - 1 ? (
                  <div
                    className={cn(
                      "outbound-draft-timeline-connector",
                      connectorActive && !connectorError && "outbound-draft-timeline-connector-active",
                      connectorError && "outbound-draft-timeline-connector-error",
                    )}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
