import {
  DEFAULT_BOOKING_TIMEZONE,
  addDays,
  formatDateKeyInZone,
  formatTimezoneLabel,
  zonedDateTimeToUtc,
} from "./booking-utils";

export type CampaignDripStepConfig = {
  step: number;
  label: string;
  delayDays: number;
  sendHour: number;
  sendMinute: number;
};

export const DRIP_TIMEZONE = DEFAULT_BOOKING_TIMEZONE;

export const DEFAULT_CAMPAIGN_DRIP_STEPS: CampaignDripStepConfig[] = [
  { step: 1, label: "Contact", delayDays: 0, sendHour: 9, sendMinute: 0 },
  { step: 2, label: "Opvolging", delayDays: 4, sendHour: 9, sendMinute: 0 },
  { step: 3, label: "Laatste keer", delayDays: 8, sendHour: 9, sendMinute: 0 },
];

export function parseCampaignDripSteps(steps: unknown): CampaignDripStepConfig[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    return DEFAULT_CAMPAIGN_DRIP_STEPS;
  }

  const parsed = steps
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const step = Number(item.step);
      if (!Number.isFinite(step) || step < 1 || step > 3) return null;
      return {
        step,
        label: typeof item.label === "string" ? item.label : `Stap ${step}`,
        delayDays: Math.max(0, Math.min(90, Number(item.delayDays) || 0)),
        sendHour: Math.max(0, Math.min(23, Number(item.sendHour ?? 9))),
        sendMinute: Math.max(0, Math.min(59, Number(item.sendMinute ?? 0))),
      } satisfies CampaignDripStepConfig;
    })
    .filter((item): item is CampaignDripStepConfig => item !== null)
    .sort((a, b) => a.step - b.step);

  return parsed.length > 0 ? parsed : DEFAULT_CAMPAIGN_DRIP_STEPS;
}

export function getDripStepConfig(
  steps: CampaignDripStepConfig[],
  sequenceStep: number,
): CampaignDripStepConfig {
  return (
    steps.find((s) => s.step === sequenceStep) ??
    DEFAULT_CAMPAIGN_DRIP_STEPS.find((s) => s.step === sequenceStep) ??
    DEFAULT_CAMPAIGN_DRIP_STEPS[0]
  );
}

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

/** Target send instant: base + delayDays at sendHour:sendMinute in Europe/Brussels. */
export function computeDripScheduledFor(
  base: Date,
  stepConfig: CampaignDripStepConfig,
  timeZone: string = DRIP_TIMEZONE,
): Date {
  const baseKey = formatDateKeyInZone(base, timeZone);
  const anchor = zonedDateTimeToUtc(baseKey, "12:00", timeZone);
  const targetKey = formatDateKeyInZone(addDays(anchor, stepConfig.delayDays), timeZone);
  const time = `${padTimePart(stepConfig.sendHour)}:${padTimePart(stepConfig.sendMinute)}`;
  const scheduled = zonedDateTimeToUtc(targetKey, time, timeZone);
  if (stepConfig.delayDays === 0 && scheduled.getTime() < base.getTime()) {
    return new Date(base);
  }
  return scheduled;
}

export function getDripTimezoneLabel(locale = "nl-BE") {
  return formatTimezoneLabel(DRIP_TIMEZONE, locale);
}
