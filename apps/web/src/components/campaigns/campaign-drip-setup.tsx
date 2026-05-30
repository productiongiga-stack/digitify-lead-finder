"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import { CalendarClock, ExternalLink, Loader2, PlayCircle, Save, Send, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

export type DripMode = "lead" | "review";

type DripStepForm = {
  step: number;
  label: string;
  delayDays: number;
  sendHour: number;
  sendMinute: number;
};

type CampaignDripSetupProps = {
  campaignId: string;
  dripMode: DripMode;
  onDripModeChange: (mode: DripMode) => void;
  campaignStatus: string;
  profileType?: string | null;
  onRunDueDrip?: () => void;
  runDueDripPending?: boolean;
};

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

export function CampaignDripSetup({
  campaignId,
  dripMode,
  onDripModeChange,
  campaignStatus,
  profileType,
  onRunDueDrip,
  runDueDripPending,
}: CampaignDripSetupProps) {
  const isReviewProfile = profileType === "REVIEW_REQUEST";
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.campaign.getDripConfig.useQuery({
    campaignId,
    mode: dripMode,
  });

  const [steps, setSteps] = useState<DripStepForm[]>([]);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const timezoneLabel = config?.timezoneLabel ?? "Europe/Brussels";

  useEffect(() => {
    if (config?.steps) {
      setSteps(
        config.steps.map((s) => ({
          step: s.step,
          label: s.label,
          delayDays: s.delayDays,
          sendHour: s.sendHour,
          sendMinute: s.sendMinute,
        })),
      );
    }
  }, [config?.steps]);

  const saveConfig = trpc.campaign.saveDripConfig.useMutation({
    onSuccess: () => {
      utils.campaign.getDripConfig.invalidate({ campaignId, mode: dripMode });
      setSavedHint("Planning opgeslagen");
      setTimeout(() => setSavedHint(null), 3000);
    },
  });

  const generateFullDrip = trpc.campaign.generateFullDrip.useMutation({
    onSuccess: (data) => {
      utils.campaign.getById.invalidate({ id: campaignId });
      utils.campaign.getStats.invalidate({ id: campaignId });
      setSavedHint(
        `${data.generatedStep1 + data.generatedStep2 + data.generatedStep3} concept(en) aangemaakt — keur goed via Outbound`,
      );
    },
  });

  const activateAll = trpc.campaign.activateAll.useMutation({
    onSuccess: (data) => {
      utils.campaign.getById.invalidate({ id: campaignId });
      utils.campaign.getStats.invalidate({ id: campaignId });
      setSavedHint(
        `Profiel actief. ${data.generatedStep1 + data.generatedStep2 + data.generatedStep3} nieuwe concept(en). Ga naar Outbound om goed te keuren.`,
      );
    },
  });

  function updateStep(stepNumber: number, patch: Partial<DripStepForm>) {
    setSteps((current) =>
      current.map((row) => (row.step === stepNumber ? { ...row, ...patch } : row)),
    );
  }

  function handleSave() {
    if (steps.length !== 3) return;
    saveConfig.mutate({ campaignId, mode: dripMode, steps });
  }

  const busy =
    saveConfig.isPending || generateFullDrip.isPending || activateAll.isPending || runDueDripPending;

  const canRunDue = campaignStatus === "ACTIVE" || campaignStatus === "PAUSED";

  return (
    <div className="space-y-3">
      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-primary" />
                Drip-campagne (3 stappen)
              </CardTitle>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Alle stappen worden als <span className="font-medium text-foreground">concept</span>{" "}
                aangemaakt. Stuur ze pas uit na goedkeuring in het Outbound Center. Verzendtijden
                zijn in {timezoneLabel}.
              </p>
            </div>
            {!isReviewProfile ? (
              <Select value={dripMode} onValueChange={(v) => onDripModeChange(v as DripMode)}>
                <SelectTrigger className="w-[150px] bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead drip</SelectItem>
                  <SelectItem value="review">Review drip</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Drip-instellingen laden…</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {steps.map((row) => (
                <div
                  key={row.step}
                  className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Stap {row.step} · {row.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Dagen na start</Label>
                      <Input
                        type="number"
                        min={0}
                        max={90}
                        value={row.step === 1 ? 0 : row.delayDays}
                        disabled={row.step === 1}
                        onChange={(e) =>
                          updateStep(row.step, {
                            delayDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Verzendtijd ({timezoneLabel})</Label>
                      <Input
                        type="time"
                        value={`${padTime(row.sendHour)}:${padTime(row.sendMinute)}`}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map((v) => parseInt(v, 10));
                          updateStep(row.step, {
                            sendHour: Number.isFinite(h) ? h : 9,
                            sendMinute: Number.isFinite(m) ? m : 0,
                          });
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Wordt concept in Outbound · doelverzendmoment na goedkeuring
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={busy || steps.length !== 3}
            >
              {saveConfig.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-2 h-3.5 w-3.5" />
              )}
              Planning opslaan
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => generateFullDrip.mutate({ campaignId, mode: dripMode })}
            >
              {generateFullDrip.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-3.5 w-3.5" />
              )}
              Genereer stap 1–3 (concept)
            </Button>
            {(campaignStatus === "DRAFT" || campaignStatus === "PAUSED") && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => activateAll.mutate({ campaignId, mode: dripMode })}
              >
                {activateAll.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-3.5 w-3.5" />
                )}
                Activeer profiel
              </Button>
            )}
            {canRunDue && onRunDueDrip ? (
              <Button variant="secondary" size="sm" disabled={busy} onClick={onRunDueDrip}>
                {runDueDripPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-2 h-3.5 w-3.5" />
                )}
                Verstuur goedgekeurde stappen
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/contacts">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Outbound Center
              </Link>
            </Button>
          </div>

          {(savedHint ||
            generateFullDrip.data ||
            activateAll.data ||
            generateFullDrip.error ||
            activateAll.error) && (
            <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {savedHint ? <p className="text-foreground">{savedHint}</p> : null}
              {generateFullDrip.data?.errors.length ? (
                <p className="text-destructive">
                  Fouten: {generateFullDrip.data.errors.slice(0, 3).join("; ")}
                </p>
              ) : null}
              {activateAll.data?.errors.length ? (
                <p className="text-destructive">
                  Fouten: {activateAll.data.errors.slice(0, 3).join("; ")}
                </p>
              ) : null}
              {(generateFullDrip.error || activateAll.error) && (
                <p className="text-destructive">
                  {generateFullDrip.error?.message || activateAll.error?.message}
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Workflow: concept aanmaken → indienen & goedkeuren in Outbound → verzenden (handmatig
            of via <span className="font-medium">Verstuur goedgekeurde stappen</span> zodra het
            doelverzendmoment ({timezoneLabel}) is bereikt). Dagelijkse cron om 09:00{" "}
            {timezoneLabel} verwerkt ook goedgekeurde mails. Open-tracking via pixel na verzending.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
