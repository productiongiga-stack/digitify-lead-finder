"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  Save,
  Settings2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@digitify/ui";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { getAppUrl } from "@/lib/config";

type DayKey = "0" | "1" | "2" | "3" | "4" | "5" | "6";
type DaySchedule = { enabled: boolean; start: string; end: string };
type WeeklyHours = Record<DayKey, DaySchedule>;

const DAY_ROWS: Array<{ key: DayKey; short: string; label: string }> = [
  { key: "1", short: "Ma", label: "Maandag" },
  { key: "2", short: "Di", label: "Dinsdag" },
  { key: "3", short: "Wo", label: "Woensdag" },
  { key: "4", short: "Do", label: "Donderdag" },
  { key: "5", short: "Vr", label: "Vrijdag" },
  { key: "6", short: "Za", label: "Zaterdag" },
  { key: "0", short: "Zo", label: "Zondag" },
];

function createDefaultWeeklyHours(start = "09:00", end = "17:00", days = ["1", "2", "3", "4", "5"]): WeeklyHours {
  return {
    0: { enabled: days.includes("0"), start, end },
    1: { enabled: days.includes("1"), start, end },
    2: { enabled: days.includes("2"), start, end },
    3: { enabled: days.includes("3"), start, end },
    4: { enabled: days.includes("4"), start, end },
    5: { enabled: days.includes("5"), start, end },
    6: { enabled: days.includes("6"), start, end },
  };
}

function parseSettingMap(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function readSettingString(map: Record<string, unknown> | undefined, key: string, fallback = "") {
  if (!map) return fallback;
  const value = map[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function readSettingBoolean(map: Record<string, unknown> | undefined, key: string, fallback = false) {
  const raw = readSettingString(map, key, String(fallback)).toLowerCase().trim();
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  return fallback;
}

function parseWeeklyHours(raw: unknown, fallbackStart: string, fallbackEnd: string, fallbackDaysCsv: string): WeeklyHours {
  const fallbackDays = fallbackDaysCsv
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);
  const next = createDefaultWeeklyHours(fallbackStart, fallbackEnd, fallbackDays);
  const parsed = parseSettingMap(raw);
  if (!parsed) return next;

  for (const row of DAY_ROWS) {
    const dayValue = parsed[row.key];
    const dayMap = parseSettingMap(dayValue);
    if (!dayMap) continue;
    const enabled = typeof dayMap.enabled === "boolean" ? dayMap.enabled : next[row.key].enabled;
    const start = readSettingString(dayMap, "start", next[row.key].start);
    const end = readSettingString(dayMap, "end", next[row.key].end);
    next[row.key] = { enabled, start, end };
  }
  return next;
}

function buildBookingSnapshot(input: {
  title: string;
  description: string;
  color: string;
  theme: string;
  brandName: string;
  meetingName: string;
  serviceName: string;
  meetingLocation: string;
  submitText: string;
  timeMode: string;
  duration: string;
  slotMinutes: string;
  weeklyHours: WeeklyHours;
  googleCalendarId: string;
  googleSyncEnabled: boolean;
  googleServiceAccountEmail: string;
  googleServicePrivateKey: string;
  googleTimezone: string;
}) {
  return JSON.stringify(input);
}

export default function BookingSettingsPage() {
  const { data: settings, isLoading, error, refetch } = trpc.settings.getAll.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      showToast({
        title: "Booking instellingen opgeslagen",
        description: "Beschikbaarheid, embed en Google synchronisatie zijn bijgewerkt.",
      });
    },
    onError: (mutationError) =>
      showToast({ title: "Opslaan mislukt", description: mutationError.message, variant: "error" }),
  });

  const [title, setTitle] = useState("Plan een afspraak");
  const [description, setDescription] = useState(
    "Vraag eenvoudig een afspraak aan. We bevestigen uw boeking zo snel mogelijk."
  );
  const [color, setColor] = useState("#f9ae5a");
  const [theme, setTheme] = useState("light");
  const [brandName, setBrandName] = useState("Digitify");
  const [meetingName, setMeetingName] = useState("Kennismaking");
  const [serviceName, setServiceName] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("Google Meet");
  const [submitText, setSubmitText] = useState("Boeking aanvragen");
  const [timeMode, setTimeMode] = useState("24");
  const [duration, setDuration] = useState("60");
  const [slotMinutes, setSlotMinutes] = useState("30");
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(createDefaultWeeklyHours());
  const [googleCalendarId, setGoogleCalendarId] = useState("");
  const [googleSyncEnabled, setGoogleSyncEnabled] = useState(false);
  const [googleServiceAccountEmail, setGoogleServiceAccountEmail] = useState("");
  const [googleServicePrivateKey, setGoogleServicePrivateKey] = useState("");
  const [googleTimezone, setGoogleTimezone] = useState("Europe/Brussels");
  const [copied, setCopied] = useState(false);
  const [snapshot, setSnapshot] = useState("");

  useEffect(() => {
    if (!settings) return;
    const nextTitle = readSettingString(settings, "bookings.embed_title", "Plan een afspraak");
    const nextDescription = readSettingString(
      settings,
      "bookings.embed_description",
      "Vraag eenvoudig een afspraak aan. We bevestigen uw boeking zo snel mogelijk."
    );
    const nextColor = readSettingString(settings, "bookings.embed_color", "#f9ae5a");
    const nextTheme = readSettingString(settings, "bookings.embed_theme", "light");
    const nextBrandName = readSettingString(
      settings,
      "bookings.embed_brand_name",
      readSettingString(settings, "branding.company_name", "Digitify")
    );
    const nextMeetingName = readSettingString(settings, "bookings.embed_meeting_name", "Kennismaking");
    const nextServiceName = readSettingString(settings, "bookings.embed_service_name", "");
    const nextMeetingLocation = readSettingString(settings, "bookings.embed_location_label", "Google Meet");
    const nextSubmitText = readSettingString(settings, "bookings.embed_submit_text", "Boeking aanvragen");
    const nextTimeMode = readSettingString(settings, "bookings.embed_time_mode", "24");
    const nextDuration = readSettingString(settings, "bookings.embed_duration", "60");
    const nextSlotMinutes = readSettingString(settings, "bookings.slot_minutes", "30");

    const fallbackStart = readSettingString(settings, "bookings.availability_start_time", "09:00");
    const fallbackEnd = readSettingString(settings, "bookings.availability_end_time", "17:00");
    const fallbackDays = readSettingString(settings, "bookings.available_days", "1,2,3,4,5");
    const nextWeeklyHours = parseWeeklyHours(settings["bookings.weekly_hours"], fallbackStart, fallbackEnd, fallbackDays);

    const nextGoogleCalendarId = readSettingString(settings, "bookings.google_calendar_id", "");
    const nextGoogleSyncEnabled = readSettingBoolean(settings, "bookings.google_sync_enabled", false);
    const nextGoogleServiceAccountEmail = readSettingString(settings, "bookings.google_service_account_email", "");
    const nextGoogleServicePrivateKey = readSettingString(settings, "bookings.google_service_account_private_key", "");
    const nextGoogleTimezone = readSettingString(settings, "bookings.google_calendar_timezone", "Europe/Brussels");

    setTitle(nextTitle);
    setDescription(nextDescription);
    setColor(nextColor);
    setTheme(nextTheme);
    setBrandName(nextBrandName);
    setMeetingName(nextMeetingName);
    setServiceName(nextServiceName);
    setMeetingLocation(nextMeetingLocation);
    setSubmitText(nextSubmitText);
    setTimeMode(nextTimeMode);
    setDuration(nextDuration);
    setSlotMinutes(nextSlotMinutes);
    setWeeklyHours(nextWeeklyHours);
    setGoogleCalendarId(nextGoogleCalendarId);
    setGoogleSyncEnabled(nextGoogleSyncEnabled);
    setGoogleServiceAccountEmail(nextGoogleServiceAccountEmail);
    setGoogleServicePrivateKey(nextGoogleServicePrivateKey);
    setGoogleTimezone(nextGoogleTimezone);
    setSnapshot(
      buildBookingSnapshot({
        title: nextTitle,
        description: nextDescription,
        color: nextColor,
        theme: nextTheme,
        brandName: nextBrandName,
        meetingName: nextMeetingName,
        serviceName: nextServiceName,
        meetingLocation: nextMeetingLocation,
        submitText: nextSubmitText,
        timeMode: nextTimeMode,
        duration: nextDuration,
        slotMinutes: nextSlotMinutes,
        weeklyHours: nextWeeklyHours,
        googleCalendarId: nextGoogleCalendarId,
        googleSyncEnabled: nextGoogleSyncEnabled,
        googleServiceAccountEmail: nextGoogleServiceAccountEmail,
        googleServicePrivateKey: nextGoogleServicePrivateKey,
        googleTimezone: nextGoogleTimezone,
      })
    );
  }, [settings]);

  const availableDaysCsv = useMemo(
    () =>
      DAY_ROWS.filter((row) => weeklyHours[row.key]?.enabled)
        .map((row) => row.key)
        .join(","),
    [weeklyHours]
  );

  const fallbackWindow = useMemo(() => {
    const firstEnabled = DAY_ROWS.find((row) => weeklyHours[row.key]?.enabled);
    const start = firstEnabled ? weeklyHours[firstEnabled.key].start : "09:00";
    const end = firstEnabled ? weeklyHours[firstEnabled.key].end : "17:00";
    return { start, end };
  }, [weeklyHours]);

  const currentSnapshot = useMemo(
    () =>
      buildBookingSnapshot({
        title,
        description,
        color,
        theme,
        brandName,
        meetingName,
        serviceName,
        meetingLocation,
        submitText,
        timeMode,
        duration,
        slotMinutes,
        weeklyHours,
        googleCalendarId,
        googleSyncEnabled,
        googleServiceAccountEmail,
        googleServicePrivateKey,
        googleTimezone,
      }),
    [
      title,
      description,
      color,
      theme,
      brandName,
      meetingName,
      serviceName,
      meetingLocation,
      submitText,
      timeMode,
      duration,
      slotMinutes,
      weeklyHours,
      googleCalendarId,
      googleSyncEnabled,
      googleServiceAccountEmail,
      googleServicePrivateKey,
      googleTimezone,
    ]
  );

  const hasChanges = currentSnapshot !== snapshot;
  const googleReady = Boolean(
    googleSyncEnabled &&
      googleCalendarId.trim() &&
      (
        Boolean(readSettingString(settings || {}, "bookings.google_oauth_account_email", "")) ||
        Boolean(googleServiceAccountEmail.trim() && googleServicePrivateKey.trim())
      )
  );
  const googleOauthEmail = readSettingString(settings || {}, "bookings.google_oauth_account_email", "");
  const googleConnectionLabel = googleOauthEmail
    ? `Google OAuth gekoppeld als ${googleOauthEmail}`
    : googleServiceAccountEmail.trim()
      ? `Service account actief: ${googleServiceAccountEmail.trim()}`
      : "Nog geen Google Agenda verbinding";
  const publicTenantToken = readSettingString(settings || {}, "chatbot.public_tenant_token", "");
  const bookingPreviewUrl = `${getAppUrl()}/embed/bookings${publicTenantToken ? `?tenant=${encodeURIComponent(publicTenantToken)}` : ""}`;

  const embedCode = useMemo(() => {
    const url = new URL(`${getAppUrl()}/embed/bookings`);
    url.searchParams.set("title", title);
    url.searchParams.set("description", description);
    url.searchParams.set("color", color);
    url.searchParams.set("theme", theme);
    url.searchParams.set("brandName", brandName);
    url.searchParams.set("meetingName", meetingName);
    if (serviceName.trim()) url.searchParams.set("service", serviceName.trim());
    url.searchParams.set("location", meetingLocation);
    url.searchParams.set("timezone", googleTimezone || "Europe/Brussels");
    url.searchParams.set("submitText", submitText);
    url.searchParams.set("timeMode", timeMode);
    url.searchParams.set("duration", duration);
    url.searchParams.set("slotMinutes", slotMinutes);
    url.searchParams.set("startTime", fallbackWindow.start);
    url.searchParams.set("endTime", fallbackWindow.end);
    url.searchParams.set("availableDays", availableDaysCsv || "1,2,3,4,5");
    url.searchParams.set("weeklyHours", JSON.stringify(weeklyHours));
    if (publicTenantToken) url.searchParams.set("tenant", publicTenantToken);

    return `<iframe
  src="${url.toString()}"
  width="100%"
  height="760"
  style="border:0;border-radius:24px;overflow:hidden"
  loading="lazy"
></iframe>`;
  }, [
    title,
    description,
    color,
    theme,
    brandName,
    meetingName,
    serviceName,
    meetingLocation,
    googleTimezone,
    submitText,
    timeMode,
    duration,
    slotMinutes,
    fallbackWindow.start,
    fallbackWindow.end,
    availableDaysCsv,
    weeklyHours,
    publicTenantToken,
  ]);

  function updateDay(day: DayKey, patch: Partial<DaySchedule>) {
    setWeeklyHours((current) => ({
      ...current,
      [day]: {
        ...current[day],
        ...patch,
      },
    }));
  }

  function handleSave() {
    const entries = [
      { key: "bookings.embed_title", value: title },
      { key: "bookings.embed_description", value: description },
      { key: "bookings.embed_color", value: color },
      { key: "bookings.embed_theme", value: theme },
      { key: "bookings.embed_brand_name", value: brandName.trim() },
      { key: "bookings.embed_meeting_name", value: meetingName.trim() },
      { key: "bookings.embed_service_name", value: serviceName.trim() },
      { key: "bookings.embed_location_label", value: meetingLocation.trim() },
      { key: "bookings.embed_submit_text", value: submitText },
      { key: "bookings.embed_time_mode", value: timeMode },
      { key: "bookings.embed_duration", value: duration },
      { key: "bookings.slot_minutes", value: slotMinutes },
      { key: "bookings.availability_start_time", value: fallbackWindow.start },
      { key: "bookings.availability_end_time", value: fallbackWindow.end },
      { key: "bookings.available_days", value: availableDaysCsv || "1,2,3,4,5" },
      { key: "bookings.weekly_hours", value: JSON.stringify(weeklyHours) },
      { key: "bookings.google_calendar_id", value: googleCalendarId.trim() },
      { key: "bookings.google_sync_enabled", value: String(googleSyncEnabled) },
      { key: "bookings.google_service_account_email", value: googleServiceAccountEmail.trim() },
      { key: "bookings.google_service_account_private_key", value: googleServicePrivateKey },
      { key: "bookings.google_calendar_timezone", value: googleTimezone.trim() || "Europe/Brussels" },
      { key: "bookings.google_calendar_url", value: "" },
    ];

    batchUpdate.mutate(entries, {
      onSuccess: () => {
        setSnapshot(currentSnapshot);
      },
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    showToast({
      title: "Embed-code gekopieerd",
      description: "De booking iframe-code staat nu op je klembord.",
    });
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Booking instellingen konden niet geladen worden</p>
          <p className="mt-1 text-muted-foreground">{error.message}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => refetch()}>
            Opnieuw proberen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/settings"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar instellingen
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Settings2 className="h-6 w-6" />
          Booking Instellingen
        </h1>
        <p className="text-sm text-muted-foreground">
          Configureer de booking embed, weekplanning en Google Workspace synchronisatie.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bookingflow</p>
              <p className="mt-1 text-sm font-medium">
                {meetingName || "Kennismaking"} / {duration} min
              </p>
              <p className="text-xs text-muted-foreground">{theme === "dark" ? "Donkere layout" : "Lichte layout"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Beschikbaarheid</p>
              <p className="mt-1 text-sm font-medium">
                {availableDaysCsv ? `${availableDaysCsv.split(",").length} actieve dagen` : "Geen dagen actief"}
              </p>
              <p className="text-xs text-muted-foreground">
                {fallbackWindow.start} - {fallbackWindow.end}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Google Agenda</p>
              <p className="mt-1 text-sm font-medium">{googleReady ? "Klaar voor live sync" : "Nog niet volledig gekoppeld"}</p>
              <p className="text-xs text-muted-foreground">{googleConnectionLabel}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Opslagstatus</p>
              <p className="mt-1 text-sm font-medium">{hasChanges ? "Niet-opgeslagen wijzigingen" : "Alles opgeslagen"}</p>
              <p className="text-xs text-muted-foreground">
                Alle booking- en Google-instellingen blijven bewaard in je settings.
              </p>
            </div>
            <Badge variant={hasChanges ? "warning" : "success"}>{hasChanges ? "Open" : "Saved"}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.7fr)_minmax(420px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Booking Configuratie
            </CardTitle>
            <CardDescription>
              Deze instellingen sturen de publieke bookingflow en de interne sync aan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a href="/api/integrations/google-calendar/connect">
                  <Globe2 className="mr-2 h-4 w-4" />
                  {googleOauthEmail ? "Google Agenda opnieuw koppelen" : "Google Agenda koppelen"}
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("google-agenda")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <Globe2 className="mr-2 h-4 w-4" />
                Open Google tab
              </Button>
              <Button type="button" variant="outline" asChild>
                <a href={bookingPreviewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open live bookingpagina
                </a>
              </Button>
            </div>
            <Tabs defaultValue="flow" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="flow">Flow</TabsTrigger>
                <TabsTrigger value="availability">Beschikbaarheid</TabsTrigger>
                <TabsTrigger value="google">Google</TabsTrigger>
                <TabsTrigger value="embed">Embed</TabsTrigger>
              </TabsList>

              <TabsContent value="flow" className="space-y-4 rounded-2xl border p-4">
                <div>
                  <Label>Publieke bookingflow</Label>
                  <p className="text-xs text-muted-foreground">
                    Branding, compacte layout en microcopy voor de publiek gedeelde boekingspagina.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Merknaam</Label>
                    <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Meetingnaam</Label>
                    <Input value={meetingName} onChange={(event) => setMeetingName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Service voor embed (optioneel)</Label>
                    <Input
                      value={serviceName}
                      onChange={(event) => setServiceName(event.target.value)}
                      placeholder="Bijv. Website intake"
                    />
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Titel</Label>
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Button tekst</Label>
                    <Input value={submitText} onChange={(event) => setSubmitText(event.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Beschrijving</Label>
                  <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Locatie label</Label>
                    <Input value={meetingLocation} onChange={(event) => setMeetingLocation(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <select
                      value={theme}
                      onChange={(event) => setTheme(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tijdweergave</Label>
                    <select
                      value={timeMode}
                      onChange={(event) => setTimeMode(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="24">24u</option>
                      <option value="12">12 uur</option>
                    </select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="availability" className="space-y-4 rounded-2xl border p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Kleur</Label>
                    <Input value={color} onChange={(event) => setColor(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duur (minuten)</Label>
                    <Input value={duration} onChange={(event) => setDuration(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slot interval</Label>
                    <Input value={slotMinutes} onChange={(event) => setSlotMinutes(event.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Beschikbaarheid per dag</Label>
                  <p className="text-xs text-muted-foreground">
                    Stel per weekdag in wanneer klanten effectief kunnen boeken.
                  </p>
                </div>
                <div className="space-y-2">
                  {DAY_ROWS.map((day) => (
                    <div key={day.key} className="grid grid-cols-[64px_1fr_1fr_auto] items-center gap-2 rounded-xl border px-3 py-2">
                      <div className="text-sm font-medium">
                        {day.short}
                        <span className="ml-1 text-xs text-muted-foreground">{day.label}</span>
                      </div>
                      <Input
                        type="time"
                        value={weeklyHours[day.key].start}
                        onChange={(event) => updateDay(day.key, { start: event.target.value })}
                        disabled={!weeklyHours[day.key].enabled}
                      />
                      <Input
                        type="time"
                        value={weeklyHours[day.key].end}
                        onChange={(event) => updateDay(day.key, { end: event.target.value })}
                        disabled={!weeklyHours[day.key].enabled}
                      />
                      <Switch
                        checked={weeklyHours[day.key].enabled}
                        onCheckedChange={(checked) => updateDay(day.key, { enabled: checked })}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="google" id="google-agenda" className="space-y-4 rounded-2xl border p-4">
                <div>
                  <Label>Google Agenda integratie</Label>
                  <p className="text-xs text-muted-foreground">
                    Gebruik OAuth voor een eenvoudige koppeling, of laat service-account sync actief als fallback voor teams.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                  <p className="font-medium">{googleOauthEmail ? "OAuth actief" : "Snelle setup"}</p>
                  <p className="mt-1 text-muted-foreground">
                    {googleOauthEmail
                      ? `Agenda verbonden via Google-auth als ${googleOauthEmail}. Nieuwe boekingen worden op die agenda gecontroleerd en ingepland.`
                      : "Klik op 'Google Agenda koppelen' om je eigen agenda veilig te verbinden zonder private key."}
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Google Calendar ID</Label>
                    <Input
                      value={googleCalendarId}
                      onChange={(event) => setGoogleCalendarId(event.target.value)}
                      placeholder="primary of team@group.calendar.google.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Input
                      value={googleTimezone}
                      onChange={(event) => setGoogleTimezone(event.target.value)}
                      placeholder="Europe/Brussels"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <div>
                    <Label>Synchronisatie actief</Label>
                    <p className="text-xs text-muted-foreground">
                      Controle op bezette slots, auto inboeken en updates bij statuswijzigingen.
                    </p>
                  </div>
                  <Switch checked={googleSyncEnabled} onCheckedChange={setGoogleSyncEnabled} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm font-medium">OAuth koppeling</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Beste keuze voor een persoonlijke of gedeelde Google Agenda.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" asChild>
                        <a href="/api/integrations/google-calendar/connect">
                          <Globe2 className="mr-2 h-4 w-4" />
                          {googleOauthEmail ? "Opnieuw verbinden" : "Verbind via Google"}
                        </a>
                      </Button>
                      <Badge variant={googleOauthEmail ? "success" : "secondary"}>
                        {googleOauthEmail ? "OAuth actief" : "Niet verbonden"}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm font-medium">Service account fallback</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Handig voor technische of gedeelde teamagenda's zonder interactieve login.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Service account e-mail</Label>
                  <Input
                    value={googleServiceAccountEmail}
                    onChange={(event) => setGoogleServiceAccountEmail(event.target.value)}
                    placeholder="digitify-bookings@project.iam.gserviceaccount.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service account private key</Label>
                  <Textarea
                    value={googleServicePrivateKey}
                    onChange={(event) => setGoogleServicePrivateKey(event.target.value)}
                    rows={5}
                    placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" asChild>
                    <a href="https://calendar.google.com" target="_blank" rel="noreferrer">
                      <Calendar className="mr-2 h-4 w-4" />
                      Open Google Agenda
                    </a>
                  </Button>
                  <Badge variant={googleReady ? "success" : "secondary"}>
                    {googleReady ? "Koppeling compleet" : "Nog configuratie nodig"}
                  </Badge>
                </div>
              </TabsContent>

              <TabsContent value="embed" className="space-y-4 rounded-2xl border p-4">
                <div>
                  <Label>Embed gebruik</Label>
                  <p className="text-xs text-muted-foreground">
                    Open de pagina live of kopieer de iframe-code uit de previewkolom.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm font-medium">Live bookingpagina</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Controleer de compacte publieke flow rechtstreeks in de browser.
                    </p>
                    <Button className="mt-3" type="button" variant="outline" asChild>
                      <a href={bookingPreviewUrl} target="_blank" rel="noreferrer">Open voorbeeld</a>
                    </Button>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm font-medium">Opslag</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Alle velden in deze tabs worden centraal opgeslagen voor de bookingflow.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleSave} disabled={batchUpdate.isPending || !hasChanges} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {batchUpdate.isPending ? "Opslaan..." : "Instellingen opslaan"}
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="text-base">Embed & Preview</CardTitle>
            <CardDescription>Kopieer de iframe-code voor je website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-6">{embedCode}</pre>
              <Button type="button" variant="outline" size="sm" className="absolute right-3 top-3" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copied ? "Gekopieerd" : "Kopieer"}
              </Button>
            </div>
            <div className={`rounded-3xl border p-5 shadow-sm ${theme === "dark" ? "bg-[#171717] text-white" : "bg-[#fcfaf5]"}`}>
              <div
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                style={{ backgroundColor: color }}
              >
                Booking preview
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">{meetingName || title}</h3>
              <p className={`mt-2 text-sm leading-6 ${theme === "dark" ? "text-white/70" : "text-muted-foreground"}`}>
                {description}
              </p>
              <div className={`mt-5 grid gap-2 text-sm ${theme === "dark" ? "text-white/70" : "text-muted-foreground"}`}>
                <div className={`rounded-2xl border px-4 py-3 ${theme === "dark" ? "border-white/10 bg-white/5" : "bg-white"}`}>Merk: {brandName}</div>
                <div className={`rounded-2xl border px-4 py-3 ${theme === "dark" ? "border-white/10 bg-white/5" : "bg-white"}`}>Locatie: {meetingLocation}</div>
                <div className={`rounded-2xl border px-4 py-3 ${theme === "dark" ? "border-white/10 bg-white/5" : "bg-white"}`}>Actieve dagen: {availableDaysCsv || "geen"}</div>
                <div className={`rounded-2xl border px-4 py-3 ${theme === "dark" ? "border-white/10 bg-white/5" : "bg-white"}`}>Slots: elke {slotMinutes} minuten</div>
                <div className={`rounded-2xl border px-4 py-3 ${theme === "dark" ? "border-white/10 bg-white/5" : "bg-white"}`}>Duur per afspraak: {duration} minuten</div>
              </div>
              <button
                type="button"
                className="mt-5 h-11 w-full rounded-full px-4 text-sm font-semibold text-slate-950"
                style={{ backgroundColor: color }}
              >
                {submitText}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
