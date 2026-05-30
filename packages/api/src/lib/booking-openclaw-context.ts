import { type PrismaClient } from "@digitify/db";
import {
  addMinutes,
  applyWorkspaceEmbedSettingsToEventType,
  ensureDefaultBookingEventType,
  eventTypeNeedsAvailabilityRuleSync,
  formatDateKey,
  getBookingAvailabilityBounds,
  getWeekdayInZone,
  hasBookingOverlap,
  loadEmbedAvailabilityRulesFromSettings,
  minutesToTime,
  overlapsBusyWindow,
  timeToMinutes,
  zonedDateTimeToUtc,
} from "./booking-utils";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";
import {
  isGoogleSlotAvailable,
  listGoogleBusyWindows,
  listGoogleCalendarEvents,
  loadGoogleCalendarSyncConfig,
} from "./google-calendar";

export type BookingOpenClawAssistContext = {
  timezone: string;
  googleSyncEnabled: boolean;
  googleOAuthConnected: boolean;
  googleServiceAccountConfigured: boolean;
  calendarId: string;
  activeWeekdayLabels: string;
  durationMinutes: number;
  slotMinutes: number;
  minimumNoticeHours: number;
  maximumHorizonDays: number;
  publicTenantConfigured: boolean;
  defaultEventType: {
    slug: string;
    name: string;
    enabledRuleCount: number;
    rulesSyncedFromSettings: boolean;
  } | null;
  nextSevenDays: {
    date: string;
    status: "available" | "partial" | "full" | "none";
    availableSlots: number;
    totalSlots: number;
  }[];
  googleCalendarProbe: {
    enabled: boolean;
    readable: boolean;
    upcomingEventsNext7Days: number;
  };
  checklist: string[];
};

const WEEKDAY_LABELS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

function weekdayLabel(index: number) {
  return WEEKDAY_LABELS[index] ?? String(index);
}

export async function buildBookingOpenClawAssistContext(
  db: PrismaClient,
  workspaceId: string,
): Promise<BookingOpenClawAssistContext> {
  const settingsRows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [
    "bookings.google_sync_enabled",
    "bookings.google_calendar_id",
    "bookings.google_oauth_account_email",
    "bookings.google_service_account_email",
    "bookings.google_service_account_private_key",
    "bookings.google_calendar_timezone",
    "bookings.embed_duration",
    "bookings.slot_minutes",
    "bookings.available_days",
    "bookings.weekly_hours",
    "chatbot.public_tenant_token",
  ]);
  const settings = settingsRowsToMap(settingsRows);

  const googleSyncEnabled = getSettingBoolean(settings, "bookings.google_sync_enabled", false);
  const googleOAuthConnected = Boolean(getSettingString(settings, "bookings.google_oauth_account_email", ""));
  const googleServiceAccountConfigured = Boolean(
    getSettingString(settings, "bookings.google_service_account_email", "") &&
      getSettingString(settings, "bookings.google_service_account_private_key", ""),
  );
  const calendarId = getSettingString(settings, "bookings.google_calendar_id", "");
  const timezone = getSettingString(settings, "bookings.google_calendar_timezone", "Europe/Brussels");
  const publicTenantConfigured = Boolean(getSettingString(settings, "chatbot.public_tenant_token", ""));

  const settingsRules = await loadEmbedAvailabilityRulesFromSettings(db, workspaceId);
  const activeWeekdayLabels = settingsRules
    .filter((rule) => rule.enabled)
    .map((rule) => weekdayLabel(rule.weekday))
    .join(", ");

  const defaultEventType = await ensureDefaultBookingEventType(db, workspaceId);
  let eventType = defaultEventType;
  let rulesSyncedFromSettings = false;
  if (eventType) {
    rulesSyncedFromSettings = eventTypeNeedsAvailabilityRuleSync(eventType.availabilityRules, settingsRules);
    if (rulesSyncedFromSettings) {
      await applyWorkspaceEmbedSettingsToEventType(db, workspaceId, eventType.id);
      const refreshed = await db.bookingEventType.findFirst({
        where: { id: eventType.id, createdById: workspaceId },
        include: { availabilityRules: true },
      });
      if (refreshed) eventType = { ...eventType, availabilityRules: refreshed.availabilityRules };
      rulesSyncedFromSettings = true;
    }
  }

  const checklist: string[] = [];
  if (!activeWeekdayLabels) checklist.push("Geen actieve weekdagen in bookings.weekly_hours / available_days.");
  if (!publicTenantConfigured) checklist.push("Geen chatbot.public_tenant_token — embed kan tenant niet oplossen.");
  if (!googleSyncEnabled) checklist.push("Google sync staat uit (bookings.google_sync_enabled).");
  if (googleSyncEnabled && !calendarId) checklist.push("Google calendar ID ontbreekt.");
  if (googleSyncEnabled && !googleOAuthConnected && !googleServiceAccountConfigured) {
    checklist.push("Google sync aan maar geen OAuth of service account credentials.");
  }

  const nextSevenDays: BookingOpenClawAssistContext["nextSevenDays"] = [];
  if (eventType) {
    const { earliest, latest } = getBookingAvailabilityBounds(eventType);
    const rules = new Map(eventType.availabilityRules.map((rule) => [rule.weekday, rule]));
    const hostUserId = workspaceId;

    let googleEnabled = false;
    let googleWindows: Array<{ start: Date; end: Date; allDay: boolean }> = [];
    try {
      const google = await listGoogleBusyWindows(db, {
        timeMin: new Date(),
        timeMax: new Date(Date.now() + 8 * 24 * 60 * 60_000),
        userId: hostUserId,
      });
      googleEnabled = google.enabled;
      googleWindows = google.windows;
    } catch {
      googleEnabled = false;
    }

    const hostTz = eventType.timezone?.trim() || timezone;

    for (let offset = 0; offset < 7; offset += 1) {
      const cursor = new Date();
      cursor.setDate(cursor.getDate() + offset);
      const dateKey = formatDateKey(cursor);
      const weekday = getWeekdayInZone(dateKey, hostTz);
      const rule = rules.get(weekday);
      if (!rule?.enabled) {
        nextSevenDays.push({ date: dateKey, status: "none", availableSlots: 0, totalSlots: 0 });
        continue;
      }

      let totalSlots = 0;
      let availableSlots = 0;
      const startMinutes = timeToMinutes(rule.startTime, 9 * 60);
      const endMinutes = timeToMinutes(rule.endTime, 17 * 60);
      const interval = Math.max(5, eventType.slotMinutes || 30);
      const duration = Math.max(5, eventType.duration || 30);

      for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += interval) {
        const time = minutesToTime(minutes);
        const start = zonedDateTimeToUtc(dateKey, time, hostTz);
        const end = addMinutes(start, duration);
        if (start < earliest || start > latest) continue;
        totalSlots += 1;
        const bufferedStart = addMinutes(start, -(eventType.bufferBefore || 0));
        const bufferedEnd = addMinutes(end, eventType.bufferAfter || 0);
        const overlap = await hasBookingOverlap(db, {
          ownerUserId: workspaceId,
          hostUserId,
          start: bufferedStart,
          end: bufferedEnd,
        });
        if (overlap) continue;
        if (googleEnabled && overlapsBusyWindow(bufferedStart, bufferedEnd, googleWindows, { hostTimeZone: hostTz })) {
          continue;
        }
        availableSlots += 1;
      }

      const status =
        totalSlots === 0
          ? "none"
          : availableSlots === 0
            ? "full"
            : availableSlots < totalSlots
              ? "partial"
              : "available";
      nextSevenDays.push({ date: dateKey, status, availableSlots, totalSlots });
    }

    if (nextSevenDays.every((day) => day.status === "none")) {
      checklist.push("Komende 7 dagen: geen enkele slot in horizon of weekuren (controleer maximumHorizonDays).");
    }
    if (nextSevenDays.every((day) => day.status === "full")) {
      checklist.push("Komende 7 dagen: alle slots geblokkeerd (Google Agenda of bestaande boekingen).");
    }
  }

  let googleCalendarProbe = { enabled: false, readable: false, upcomingEventsNext7Days: 0 };
  try {
    await loadGoogleCalendarSyncConfig(db, workspaceId);
    const slot = await isGoogleSlotAvailable(db, {
      start: new Date(),
      end: new Date(Date.now() + 15 * 60_000),
      userId: workspaceId,
    });
    googleCalendarProbe = {
      enabled: slot.enabled,
      readable: slot.enabled,
      upcomingEventsNext7Days: 0,
    };
    if (slot.enabled) {
      const listed = await listGoogleCalendarEvents(db, {
        timeMin: new Date(),
        timeMax: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        userId: workspaceId,
      });
      googleCalendarProbe.upcomingEventsNext7Days = listed.events.length;
    }
  } catch {
    checklist.push("Google Agenda test mislukt — controleer OAuth tokens of service account.");
  }

  return {
    timezone,
    googleSyncEnabled,
    googleOAuthConnected,
    googleServiceAccountConfigured,
    calendarId,
    activeWeekdayLabels: activeWeekdayLabels || "geen",
    durationMinutes: Number(getSettingString(settings, "bookings.embed_duration", "60")) || 60,
    slotMinutes: Number(getSettingString(settings, "bookings.slot_minutes", "30")) || 30,
    minimumNoticeHours: eventType?.minimumNoticeHours ?? 4,
    maximumHorizonDays: eventType?.maximumHorizonDays ?? 60,
    publicTenantConfigured,
    defaultEventType: eventType
      ? {
          slug: eventType.slug,
          name: eventType.name,
          enabledRuleCount: eventType.availabilityRules.filter((rule) => rule.enabled).length,
          rulesSyncedFromSettings,
        }
      : null,
    nextSevenDays,
    googleCalendarProbe,
    checklist,
  };
}
