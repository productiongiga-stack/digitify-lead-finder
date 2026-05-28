import { createSign } from "node:crypto";
import { type PrismaClient } from "@digitify/db";
import { getSettingBoolean, getSettingString, settingsRowsToMap, type SettingRow } from "./settings";
import { resolveWorkspaceOwnerId } from "./workspace";
import { loadUserSettingRows } from "./user-settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";

type SettingsDb = {
  setting: {
    findMany: (args?: any) => Promise<SettingRow[]>;
  };
  user?: {
    findFirst: (args?: any) => Promise<{ id: string; workspaceOwnerId?: string | null } | null>;
    findUnique?: (args?: any) => Promise<{ id: string; workspaceOwnerId?: string | null } | null>;
  };
};

export type GoogleCalendarListedEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  htmlLink: string | null;
  allDay: boolean;
};

function isPrismaSettingsDb(db: SettingsDb): db is PrismaClient {
  return Boolean(db.user?.findUnique || db.user?.findFirst);
}

function mergeSettingRows(fallback: SettingRow[], primary: SettingRow[]) {
  const merged = new Map<string, SettingRow>();
  for (const row of fallback) merged.set(row.key, row);
  for (const row of primary) merged.set(row.key, row);
  return Array.from(merged.values());
}

export type GoogleCalendarSyncConfig = {
  enabled: boolean;
  calendarId: string;
  serviceAccountEmail: string;
  privateKey: string;
  oauthAccessToken: string;
  oauthRefreshToken: string;
  oauthAccountEmail: string;
  timezone: string;
  appName: string;
  oauthClientId: string;
  oauthClientSecret: string;
};

type GoogleEventWindow = {
  bookingId?: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  attendeeEmail?: string;
  location?: string;
  existingEventId?: string | null;
  userId?: string;
};

type GoogleEventItem = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string; label?: string }>;
    conferenceId?: string;
  };
  attendees?: Array<{ email?: string; responseStatus?: string }>;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function base64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizePrivateKey(raw: string) {
  return raw.replace(/\\n/g, "\n").trim();
}

function toIso(value: Date) {
  return value.toISOString();
}

function eventDateToDate(value?: { dateTime?: string; date?: string }) {
  if (!value) return null;
  if (value.dateTime) return new Date(value.dateTime);
  if (value.date) return new Date(`${value.date}T00:00:00.000Z`);
  return null;
}

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

function extractMeetLinkFromEvent(event: Pick<GoogleEventItem, "hangoutLink" | "conferenceData">) {
  if (event.hangoutLink) return event.hangoutLink;
  return event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video" && entry.uri)?.uri || null;
}

export async function loadGoogleOAuthClientConfig(db?: SettingsDb) {
  const envClientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  let ownerClientId = "";
  let ownerClientSecret = "";

  if (db?.user?.findFirst) {
    const owner = await db.user.findFirst({
      where: { role: "OWNER" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (owner?.id) {
      const rows = await loadWorkspaceSettingRows(
        db as any,
        { workspaceId: owner.id, memberId: owner.id },
        ["integrations.google_oauth_client_id", "integrations.google_oauth_client_secret"],
      );
      const settings = settingsRowsToMap(rows);
      ownerClientId = getSettingString(settings, "integrations.google_oauth_client_id");
      ownerClientSecret = getSettingString(settings, "integrations.google_oauth_client_secret");
    }
  }

  return {
    clientId: ownerClientId || envClientId,
    clientSecret: ownerClientSecret || envClientSecret,
    source: ownerClientId && ownerClientSecret ? "settings" : envClientId && envClientSecret ? "env" : "missing",
  };
}

async function getAccessToken(config: GoogleCalendarSyncConfig) {
  if (config.oauthRefreshToken) {
    const clientId = config.oauthClientId;
    const clientSecret = config.oauthClientSecret;
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth client is niet geconfigureerd.");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: config.oauthRefreshToken,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google OAuth refresh fout (${response.status}): ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("Google OAuth access token ontbreekt");
    return data.access_token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: config.serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(normalizePrivateKey(config.privateKey), "base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token fout (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token ontbreekt");
  return data.access_token;
}

async function googleCalendarRequest<T>(
  config: GoogleCalendarSyncConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getAccessToken(config);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Calendar fout (${response.status}): ${body.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

export function extractGoogleEventId(notes: string | null | undefined) {
  if (!notes) return null;
  const match = notes.match(/\[\[GCAL_EVENT_ID=([^\]]+)\]\]/);
  return match?.[1]?.trim() || null;
}

export function upsertGoogleEventIdInNotes(notes: string | null | undefined, eventId: string | null) {
  const base = (notes || "").replace(/\n?\[\[GCAL_EVENT_ID=[^\]]+\]\]/g, "").trim();
  if (!eventId) return base || null;
  return `${base ? `${base}\n` : ""}[[GCAL_EVENT_ID=${eventId}]]`;
}

export async function loadGoogleCalendarSyncConfig(db: SettingsDb, userId?: string): Promise<GoogleCalendarSyncConfig> {
  const keys = [
    "bookings.google_sync_enabled",
    "bookings.google_calendar_id",
    "bookings.google_service_account_email",
    "bookings.google_service_account_private_key",
    "bookings.google_oauth_access_token",
    "bookings.google_oauth_refresh_token",
    "bookings.google_oauth_account_email",
    "bookings.google_calendar_timezone",
    "branding.company_name",
  ];

  let settingRows: SettingRow[] = [];
  if (userId && isPrismaSettingsDb(db)) {
    const workspaceId = await resolveWorkspaceOwnerId(db, userId);
    const workspaceRows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: userId }, keys);
    const workspaceMap = settingsRowsToMap(workspaceRows);
    const hasWorkspaceAuth = Boolean(
      getSettingString(workspaceMap, "bookings.google_oauth_refresh_token") ||
        getSettingString(workspaceMap, "bookings.google_service_account_private_key")
    );
    if (!hasWorkspaceAuth && userId !== workspaceId) {
      const memberRows = await loadUserSettingRows(db, userId, keys);
      settingRows = mergeSettingRows(memberRows, workspaceRows);
    } else {
      settingRows = workspaceRows;
    }
  } else if (userId) {
    settingRows = (
      await db.setting.findMany({ where: { key: { in: keys.map((key) => `user:${userId}:${key}`) } } } as any)
    ).map((row) => ({
      ...row,
      key: row.key.replace(`user:${userId}:`, ""),
    }));
  } else {
    settingRows = await db.setting.findMany({ where: { key: { in: keys } } } as any);
  }

  const map = settingsRowsToMap(settingRows);
  const oauthClient = await loadGoogleOAuthClientConfig(db);

  return {
    enabled: getSettingBoolean(map, "bookings.google_sync_enabled", false),
    calendarId: getSettingString(map, "bookings.google_calendar_id"),
    serviceAccountEmail: getSettingString(map, "bookings.google_service_account_email"),
    privateKey: getSettingString(map, "bookings.google_service_account_private_key"),
    oauthAccessToken: getSettingString(map, "bookings.google_oauth_access_token"),
    oauthRefreshToken: getSettingString(map, "bookings.google_oauth_refresh_token"),
    oauthAccountEmail: getSettingString(map, "bookings.google_oauth_account_email"),
    timezone: getSettingString(map, "bookings.google_calendar_timezone", "Europe/Brussels"),
    appName: getSettingString(map, "branding.company_name", "Digitify"),
    oauthClientId: oauthClient.clientId,
    oauthClientSecret: oauthClient.clientSecret,
  };
}

export async function listGoogleCalendarEvents(
  db: SettingsDb,
  options: { timeMin: Date; timeMax: Date; userId?: string }
) {
  const config = await loadGoogleCalendarSyncConfig(db, options.userId);
  if (!config.enabled || !config.calendarId || !hasGoogleAuth(config)) {
    return {
      enabled: false as const,
      events: [] as GoogleCalendarListedEvent[],
      accountEmail: config.oauthAccountEmail || null,
      calendarId: config.calendarId || null,
    };
  }

  const params = new URLSearchParams({
    timeMin: toIso(options.timeMin),
    timeMax: toIso(options.timeMax),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const payload = await googleCalendarRequest<{ items?: GoogleEventItem[] }>(
    config,
    `/events?${params.toString()}`,
    { method: "GET" }
  );

  const events: GoogleCalendarListedEvent[] = (payload.items || [])
    .filter((item) => item?.id && item.status !== "cancelled")
    .map((item) => {
      const start = eventDateToDate(item.start);
      const end = eventDateToDate(item.end);
      const allDay = Boolean(item.start?.date && !item.start?.dateTime);
      return {
        id: item.id!,
        title: item.summary?.trim() || "Agenda-afspraak",
        start: start ? start.toISOString() : options.timeMin.toISOString(),
        end: end ? end.toISOString() : options.timeMax.toISOString(),
        htmlLink: item.htmlLink || null,
        allDay,
      };
    });

  return {
    enabled: true as const,
    events,
    accountEmail: config.oauthAccountEmail || null,
    calendarId: config.calendarId,
  };
}

function hasGoogleAuth(config: GoogleCalendarSyncConfig) {
  return Boolean(
    config.oauthRefreshToken ||
      (config.serviceAccountEmail && config.privateKey)
  );
}

export async function isGoogleSlotAvailable(
  db: SettingsDb,
  options: { start: Date; end: Date; ignoreEventId?: string | null; userId?: string }
) {
  const config = await loadGoogleCalendarSyncConfig(db, options.userId);
  if (!config.enabled || !config.calendarId || !hasGoogleAuth(config)) {
    return { enabled: false, available: true as const };
  }

  const params = new URLSearchParams({
    timeMin: toIso(options.start),
    timeMax: toIso(options.end),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const payload = await googleCalendarRequest<{ items?: GoogleEventItem[] }>(
    config,
    `/events?${params.toString()}`,
    { method: "GET" }
  );

  const items = payload.items || [];
  const hasOverlap = items.some((item) => {
    if (!item || item.status === "cancelled") return false;
    if (options.ignoreEventId && item.id === options.ignoreEventId) return false;
    const start = eventDateToDate(item.start);
    const end = eventDateToDate(item.end);
    if (!start || !end) return false;
    return overlap(options.start, options.end, start, end);
  });

  return { enabled: true, available: !hasOverlap };
}

export async function upsertGoogleBookingEvent(
  db: SettingsDb,
  options: GoogleEventWindow
): Promise<{ synced: boolean; eventId: string | null; htmlLink?: string; meetLink?: string | null }> {
  const config = await loadGoogleCalendarSyncConfig(db, options.userId);
  if (!config.enabled || !config.calendarId || !hasGoogleAuth(config)) {
    return { synced: false, eventId: options.existingEventId || null };
  }

  const payload = {
    summary: options.summary,
    description: options.description || "",
    location: options.location || undefined,
    start: { dateTime: toIso(options.start), timeZone: config.timezone },
    end: { dateTime: toIso(options.end), timeZone: config.timezone },
    attendees: options.attendeeEmail ? [{ email: options.attendeeEmail }] : undefined,
    conferenceData: {
      createRequest: {
        requestId: `digitify-${options.bookingId || options.existingEventId || Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  if (options.existingEventId) {
    try {
      const updated = await googleCalendarRequest<{ id?: string; htmlLink?: string; hangoutLink?: string; conferenceData?: GoogleEventItem["conferenceData"] }>(
        config,
        `/events/${encodeURIComponent(options.existingEventId)}?conferenceDataVersion=1`,
        { method: "PATCH", body: JSON.stringify(payload) }
      );
      return {
        synced: true,
        eventId: updated.id || options.existingEventId,
        htmlLink: updated.htmlLink,
        meetLink: extractMeetLinkFromEvent(updated),
      };
    } catch {
      // Fallback to create when previous event no longer exists.
    }
  }

  const created = await googleCalendarRequest<{ id?: string; htmlLink?: string; hangoutLink?: string; conferenceData?: GoogleEventItem["conferenceData"] }>(config, "/events?conferenceDataVersion=1", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { synced: true, eventId: created.id || null, htmlLink: created.htmlLink, meetLink: extractMeetLinkFromEvent(created) };
}

type GoogleTaskEventOptions = {
  taskId: string;
  title: string;
  description?: string;
  dueAt: Date;
  existingEventId?: string | null;
  userId?: string;
};

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function upsertGoogleTaskEvent(
  db: SettingsDb,
  options: GoogleTaskEventOptions,
): Promise<{ synced: boolean; eventId: string | null; htmlLink?: string | null }> {
  const config = await loadGoogleCalendarSyncConfig(db, options.userId);
  if (!config.enabled || !config.calendarId || !hasGoogleAuth(config)) {
    return { synced: false, eventId: options.existingEventId || null };
  }

  const dueStart = new Date(options.dueAt);
  dueStart.setUTCHours(0, 0, 0, 0);
  const dueEnd = new Date(dueStart);
  dueEnd.setUTCDate(dueEnd.getUTCDate() + 1);

  const payload = {
    summary: options.title,
    description: options.description || "",
    start: { date: toDateOnly(dueStart) },
    end: { date: toDateOnly(dueEnd) },
  };

  if (options.existingEventId) {
    try {
      const updated = await googleCalendarRequest<{ id?: string; htmlLink?: string }>(
        config,
        `/events/${encodeURIComponent(options.existingEventId)}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      return {
        synced: true,
        eventId: updated.id || options.existingEventId,
        htmlLink: updated.htmlLink || null,
      };
    } catch {
      // Fallback to create when previous event no longer exists.
    }
  }

  const created = await googleCalendarRequest<{ id?: string; htmlLink?: string }>(config, "/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { synced: true, eventId: created.id || null, htmlLink: created.htmlLink || null };
}

export async function deleteGoogleTaskEvent(
  db: SettingsDb,
  existingEventId: string | null | undefined,
  userId?: string,
) {
  return deleteGoogleBookingEvent(db, existingEventId, userId);
}

export async function deleteGoogleBookingEvent(
  db: SettingsDb,
  existingEventId: string | null | undefined,
  userId?: string
) {
  if (!existingEventId) return { synced: false };
  const config = await loadGoogleCalendarSyncConfig(db, userId);
  if (!config.enabled || !config.calendarId || !hasGoogleAuth(config)) {
    return { synced: false };
  }

  const token = await getAccessToken(config);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      config.calendarId
    )}/events/${encodeURIComponent(existingEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (response.status === 404 || response.status === 410 || response.status === 204) {
    return { synced: true };
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google event verwijderen mislukt (${response.status}): ${body.slice(0, 200)}`);
  }
  return { synced: true };
}

export async function getGoogleBookingEvent(
  db: SettingsDb,
  eventId: string | null | undefined,
  userId?: string
): Promise<
  | {
      enabled: false;
      found: false;
      cancelled: false;
      eventId: null;
    }
  | {
      enabled: true;
      found: boolean;
      cancelled: boolean;
      eventId: string | null;
      start: Date | null;
      end: Date | null;
      summary: string;
      description: string;
      htmlLink: string | null;
      meetLink: string | null;
      attendeeEmails: string[];
    }
> {
  if (!eventId) {
    return { enabled: false, found: false, cancelled: false, eventId: null };
  }

  const config = await loadGoogleCalendarSyncConfig(db, userId);
  if (!config.enabled || !config.calendarId || !hasGoogleAuth(config)) {
    return { enabled: false, found: false, cancelled: false, eventId: null };
  }

  const token = await getAccessToken(config);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      config.calendarId
    )}/events/${encodeURIComponent(eventId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (response.status === 404 || response.status === 410) {
    return {
      enabled: true,
      found: false,
      cancelled: false,
      eventId: null,
      start: null,
      end: null,
      summary: "",
      description: "",
      htmlLink: null,
      meetLink: null,
      attendeeEmails: [],
    };
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google event ophalen mislukt (${response.status}): ${body.slice(0, 200)}`);
  }

  const event = (await response.json()) as GoogleEventItem;
  return {
    enabled: true,
    found: true,
    cancelled: event.status === "cancelled",
    eventId: event.id || eventId,
    start: eventDateToDate(event.start),
    end: eventDateToDate(event.end),
    summary: event.summary || "",
    description: event.description || "",
    htmlLink: event.htmlLink || null,
    meetLink: extractMeetLinkFromEvent(event),
    attendeeEmails: (event.attendees || [])
      .map((attendee) => attendee.email?.trim() || "")
      .filter(Boolean),
  };
}
