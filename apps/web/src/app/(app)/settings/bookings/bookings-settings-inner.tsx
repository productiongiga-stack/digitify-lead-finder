"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { OpenClawPageAssist } from "@/components/openclaw/openclaw-page-assist";
import { useEffectiveAppRole } from "@/lib/use-effective-app-role";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Globe2,
  Layers,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  Webhook,
  Zap,
  Code2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { getBookingTimezoneOptions, resolveBookingTimezoneSelectValue } from "@/lib/booking-timezone";
import { getAppUrl } from "@/lib/config";
import { hasRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const SECRET_MASK = "••••••••";

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

const ALL_WEBHOOK_EVENTS = [
  "booking.created",
  "booking.confirmed",
  "booking.rejected",
  "booking.cancelled",
  "booking.completed",
  "booking.updated",
] as const;
type WebhookEventKey = (typeof ALL_WEBHOOK_EVENTS)[number];

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
  approvalMode: string;
  webhookUrl: string;
  webhookSecret: string;
  webhookEvents: string[];
  reminders24hEnabled: boolean;
  reminders1hEnabled: boolean;
}) {
  return JSON.stringify(input);
}

// ─── Booking Event Type Manager ───────────────────────────────────────────────

function BookingEventTypeManager({ publicTenantToken }: { publicTenantToken: string }) {
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const { data: eventTypes, isLoading } = trpc.booking.listEventTypes.useQuery();
  type EventType = NonNullable<NonNullable<typeof eventTypes>[number]>;
  const eventTypeItems = (eventTypes ?? []).filter((item): item is EventType => Boolean(item));
  const [editTarget, setEditTarget] = useState<null | {
    id?: string;
    name: string;
    slug: string;
    description: string;
    duration: number;
    slotMinutes: number;
    color: string;
    location: string;
    approvalMode: string;
    isActive: boolean;
  }>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; name: string }>(null);

  const upsertMutation = trpc.booking.upsertEventType.useMutation({
    onSuccess: () => {
      utils.booking.listEventTypes.invalidate();
      setEditTarget(null);
      showToast({ title: "Boekingstype opgeslagen" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const deleteMutation = trpc.booking.deleteEventType.useMutation({
    onSuccess: () => {
      utils.booking.listEventTypes.invalidate();
      setDeleteTarget(null);
      showToast({ title: "Boekingstype verwijderd" });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  function openCreate() {
    setEditTarget({
      name: "",
      slug: "",
      description: "",
      duration: 60,
      slotMinutes: 30,
      color: "#f9ae5a",
      location: "Google Meet",
      approvalMode: "manual",
      isActive: true,
    });
  }

  function openEdit(et: EventType) {
    setEditTarget({
      id: et.id,
      name: et.name,
      slug: et.slug,
      description: et.description || "",
      duration: et.duration,
      slotMinutes: et.slotMinutes,
      color: et.color,
      location: et.location || "",
      approvalMode: et.approvalMode,
      isActive: et.isActive,
    });
  }

  function handleSave() {
    if (!editTarget || !editTarget.name.trim()) return;
    upsertMutation.mutate({
      id: editTarget.id,
      name: editTarget.name.trim(),
      slug: editTarget.slug.trim() || undefined,
      description: editTarget.description,
      duration: editTarget.duration,
      slotMinutes: editTarget.slotMinutes,
      color: editTarget.color,
      location: editTarget.location,
      approvalMode: editTarget.approvalMode,
      isActive: editTarget.isActive,
    });
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Boekingstypes</Label>
          <p className="text-xs text-muted-foreground">
            Maak meerdere types aan — elk met eigen duur, beschikbaarheid en embed URL.
          </p>
        </div>
        <Button size="sm" type="button" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nieuw type
        </Button>
      </div>

      <div className="space-y-2">
        {eventTypeItems.map((et) => {
          const embedUrl = `${getAppUrl()}/embed/bookings${publicTenantToken ? `?tenant=${encodeURIComponent(publicTenantToken)}&eventType=${encodeURIComponent(et.slug)}` : ""}`;
          return (
            <div key={et.id} className="flex items-center gap-3 rounded-xl border px-4 py-3">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: et.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{et.name}</p>
                  {et.isDefault && (
                    <Badge variant="secondary" className="text-xs">Standaard</Badge>
                  )}
                  {!et.isActive && (
                    <Badge variant="destructive" className="text-xs">Inactief</Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {et.duration} min
                  </span>
                  <span className="font-mono">/{et.slug}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {publicTenantToken && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={embedUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" type="button" onClick={() => openEdit(et)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!et.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setDeleteTarget({ id: et.id, name: et.name })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditTarget(null)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">{editTarget.id ? "Boekingstype bewerken" : "Nieuw boekingstype"}</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Naam *</Label>
                <Input
                  value={editTarget.name}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, name: e.target.value } : t)}
                  placeholder="bijv. Intake gesprek"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Duur (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    value={editTarget.duration}
                    onChange={(e) => setEditTarget((t) => t ? { ...t, duration: Number(e.target.value) } : t)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Interval (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    value={editTarget.slotMinutes}
                    onChange={(e) => setEditTarget((t) => t ? { ...t, slotMinutes: Number(e.target.value) } : t)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Locatie</Label>
                <Input
                  value={editTarget.location}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, location: e.target.value } : t)}
                  placeholder="Google Meet"
                />
              </div>
              <div className="space-y-1">
                <Label>Beschrijving</Label>
                <Textarea
                  value={editTarget.description}
                  onChange={(e) => setEditTarget((t) => t ? { ...t, description: e.target.value } : t)}
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                <Label className="cursor-pointer">Actief</Label>
                <Switch
                  checked={editTarget.isActive}
                  onCheckedChange={(v) => setEditTarget((t) => t ? { ...t, isActive: v } : t)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setEditTarget(null)}>Annuleren</Button>
              <Button type="button" disabled={upsertMutation.isPending || !editTarget.name.trim()} onClick={handleSave}>
                {upsertMutation.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">Boekingstype verwijderen?</h3>
            <p className="text-sm text-muted-foreground">
              <strong>{deleteTarget.name}</strong> wordt op inactief gezet. Bestaande boekingen blijven bewaard.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>Annuleren</Button>
              <Button
                variant="destructive"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deleteTarget.id })}
              >
                {deleteMutation.isPending ? "Verwijderen..." : "Verwijderen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Setup checklist ───────────────────────────────────────────────────────────

function BookingSetupChecklist({
  googleDone,
  googleDescription,
  availabilityDone,
  availabilityDescription,
  embedDone,
  embedDescription,
  automationsDone,
  automationsDescription,
}: {
  googleDone: boolean;
  googleDescription: string;
  availabilityDone: boolean;
  availabilityDescription: string;
  embedDone: boolean;
  embedDescription: string;
  automationsDone: boolean;
  automationsDescription: string;
}) {
  const items = [
    {
      id: "google",
      title: "Google Agenda",
      description: googleDescription,
      done: googleDone,
      icon: Calendar,
    },
    {
      id: "availability",
      title: "Beschikbaarheid",
      description: availabilityDescription,
      done: availabilityDone,
      icon: Clock,
    },
    {
      id: "embed",
      title: "Embed actief",
      description: embedDescription,
      done: embedDone,
      icon: ExternalLink,
    },
    {
      id: "automations",
      title: "Automaties",
      description: automationsDescription,
      done: automationsDone,
      icon: Webhook,
    },
  ];

  const completedCount = items.filter((item) => item.done).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  return (
    <div className="settings-setup-checklist">
      <div className="settings-setup-checklist-accent" />
      <div className="settings-setup-checklist-header">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Setup checklist</p>
            <p className="text-xs text-muted-foreground">
              {completedCount === items.length
                ? "Je bookingflow is klaar om live te gaan."
                : "Voltooi de open stappen om alles werkend te krijgen."}
            </p>
          </div>
        </div>
        <div className="w-full min-w-[200px] space-y-1.5 sm:max-w-xs">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-muted-foreground">Voortgang</span>
            <span className="tabular-nums text-foreground">
              {completedCount}/{items.length} klaar
            </span>
          </div>
          <div className="settings-setup-checklist-progress-track">
            <div
              className="settings-setup-checklist-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      <div className="settings-setup-checklist-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "settings-setup-checklist-item",
                item.done ? "settings-setup-checklist-item-done" : "settings-setup-checklist-item-pending",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                  item.done
                    ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400",
                )}
              >
                {item.done ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────

export function BookingsSettingsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = useEffectiveAppRole();
  const isWorkspaceOwner = hasRole(role, ["OWNER"]);
  const { data: settings, isLoading, error, refetch } = trpc.settings.getBookingsSettings.useQuery(undefined, {
    retry: 1,
    ...SETTINGS_PAGE_QUERY_OPTS,
  });
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const syncHostTimezone = trpc.booking.syncHostTimezone.useMutation();
  const syncEmbedFromSettings = trpc.booking.syncEmbedFromSettings.useMutation();
  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getBookingsSettings.invalidate();
      showToast({
        title: "Booking instellingen opgeslagen",
        description: "Beschikbaarheid, embed en Google synchronisatie zijn bijgewerkt.",
      });
    },
    onError: (mutationError) =>
      showToast({ title: "Opslaan mislukt", description: mutationError.message, variant: "error" }),
  });
  const testGoogleSync = trpc.booking.testGoogleSync.useMutation({
    onSuccess: (result) =>
      showToast({
        title: result.enabled ? "Google sync getest" : "Google sync staat nog uit",
        description: result.enabled
          ? `Lezen en schrijven OK. ${result.upcomingGoogleEvents} afspraak(en) komende 7 dagen. Huidig slot: ${result.available ? "vrij" : "bezet"}.`
          : "Koppel Google Agenda en activeer synchronisatie om slots live te controleren.",
      }),
    onError: (mutationError) =>
      showToast({ title: "Google sync test mislukt", description: mutationError.message, variant: "error" }),
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
  const [googleServicePrivateKeyConfigured, setGoogleServicePrivateKeyConfigured] = useState(false);
  const [googleTimezone, setGoogleTimezone] = useState("Europe/Brussels");
  const [copied, setCopied] = useState(false);
  const [snapshot, setSnapshot] = useState("");
  const [approvalMode, setApprovalMode] = useState("manual");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookSecretConfigured, setWebhookSecretConfigured] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventKey[]>([]);
  const [reminders24hEnabled, setReminders24hEnabled] = useState(true);
  const [reminders1hEnabled, setReminders1hEnabled] = useState(true);

  const bookingTimezoneOptions = useMemo(() => {
    const options = getBookingTimezoneOptions();
    const current = googleTimezone.trim();
    if (current && !options.some((option) => option.value === current)) {
      return [{ value: current, label: `${current} (huidige waarde)` }, ...options];
    }
    return options;
  }, [googleTimezone]);

  useEffect(() => {
    const googleStatus = searchParams.get("google");
    if (!googleStatus) return;
    const messages: Record<string, { title: string; description: string; variant?: "success" | "error" | "info" }> = {
      connected: {
        title: "Google Agenda gekoppeld",
        description: "Auto-sync is ingeschakeld en je primaire agenda is geselecteerd.",
        variant: "success",
      },
      missing_config: {
        title: "Google OAuth mist configuratie",
        description:
          "Vul Client ID en Secret in via Instellingen → Integraties → Google OAuth, of zet GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in Vercel (Production). Controleer ook de redirect URL in Google Cloud Console.",
        variant: "error",
      },
      "missing-config": {
        title: "Google OAuth mist configuratie",
        description:
          "Vul Client ID en Secret in via Instellingen → Integraties → Google OAuth, of zet GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET in Vercel (Production). Controleer ook de redirect URL in Google Cloud Console.",
        variant: "error",
      },
      invalid_state: {
        title: "Google login verlopen",
        description: "Start de Google koppeling opnieuw vanuit deze pagina.",
        variant: "error",
      },
      "invalid-state": {
        title: "Google login verlopen",
        description: "Start de Google koppeling opnieuw vanuit deze pagina.",
        variant: "error",
      },
      error: {
        title: "Google koppeling mislukt",
        description: "Controleer de OAuth redirect URL en probeer opnieuw.",
        variant: "error",
      },
      access_denied: {
        title: "Google koppeling geannuleerd",
        description: "Je hebt de toegang niet toegestaan.",
        variant: "error",
      },
      "invalid-client-id": {
        title: "Google Client ID ongeldig",
        description:
          "De OAuth Client ID in Instellingen → Integraties moet een Web application zijn en eindigen op .apps.googleusercontent.com. Controleer Google Cloud Console → APIs & Services → Credentials.",
        variant: "error",
      },
      "invalid-client-secret": {
        title: "Google Client Secret ongeldig",
        description:
          "Het secret moet beginnen met GOCSPX-. Zet geen komma's of aanhalingstekens in Vercel env vars. Sla opnieuw op via Integraties.",
        variant: "error",
      },
    };
    const message = messages[googleStatus] || messages.error;
    showToast(message);
  }, [searchParams, showToast]);

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
    const nextGoogleServicePrivateKeyRaw = readSettingString(settings, "bookings.google_service_account_private_key", "");
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
    setGoogleServicePrivateKeyConfigured(Boolean(nextGoogleServicePrivateKeyRaw));
    setGoogleServicePrivateKey(nextGoogleServicePrivateKeyRaw === SECRET_MASK ? "" : nextGoogleServicePrivateKeyRaw);
    setGoogleTimezone(nextGoogleTimezone);

    const nextApprovalMode = readSettingString(settings, "bookings.default_approval_mode", "manual");
    const nextWebhookUrl = readSettingString(settings, "bookings.webhook_url", "");
    const nextWebhookSecretRaw = readSettingString(settings, "bookings.webhook_secret", "");
    const nextWebhookEventsCsv = readSettingString(settings, "bookings.webhook_events", "");
    const nextWebhookEvents = nextWebhookEventsCsv
      .split(",")
      .map((e) => e.trim())
      .filter((e): e is WebhookEventKey => ALL_WEBHOOK_EVENTS.includes(e as WebhookEventKey));

    setApprovalMode(nextApprovalMode);
    setWebhookUrl(nextWebhookUrl);
    setWebhookSecretConfigured(Boolean(nextWebhookSecretRaw));
    setWebhookSecret(nextWebhookSecretRaw === SECRET_MASK ? "" : nextWebhookSecretRaw);
    setWebhookEvents(nextWebhookEvents);
    setReminders24hEnabled(readSettingBoolean(settings, "bookings.reminders_24h_enabled", true));
    setReminders1hEnabled(readSettingBoolean(settings, "bookings.reminders_1h_enabled", true));

    const nextReminders24h = readSettingBoolean(settings, "bookings.reminders_24h_enabled", true);
    const nextReminders1h = readSettingBoolean(settings, "bookings.reminders_1h_enabled", true);

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
        googleServicePrivateKey: nextGoogleServicePrivateKeyRaw === SECRET_MASK ? "" : nextGoogleServicePrivateKeyRaw,
        googleTimezone: nextGoogleTimezone,
        approvalMode: nextApprovalMode,
        webhookUrl: nextWebhookUrl,
        webhookSecret: nextWebhookSecretRaw === SECRET_MASK ? "" : nextWebhookSecretRaw,
        webhookEvents: nextWebhookEvents,
        reminders24hEnabled: nextReminders24h,
        reminders1hEnabled: nextReminders1h,
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
        approvalMode,
        webhookUrl,
        webhookSecret,
        webhookEvents,
        reminders24hEnabled,
        reminders1hEnabled,
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
      approvalMode,
      webhookUrl,
      webhookSecret,
      webhookEvents,
      reminders24hEnabled,
      reminders1hEnabled,
    ]
  );

  const hasChanges = currentSnapshot !== snapshot;
  const googleReady = Boolean(
    googleSyncEnabled &&
      googleCalendarId.trim() &&
      (
        Boolean(readSettingString(settings || {}, "bookings.google_oauth_account_email", "")) ||
        Boolean(
          googleServiceAccountEmail.trim() &&
            (googleServicePrivateKey.trim() || googleServicePrivateKeyConfigured),
        )
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

  const activeDayCount = availableDaysCsv.split(",").filter(Boolean).length;
  const googleChecklistDone = Boolean(googleOauthEmail || googleServiceAccountEmail.trim());
  const embedChecklistDone = Boolean(publicTenantToken);
  const automationsChecklistDone = Boolean(webhookUrl.trim()) || approvalMode === "automatic";

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

  function toggleWebhookEvent(event: WebhookEventKey) {
    setWebhookEvents((current) =>
      current.includes(event) ? current.filter((e) => e !== event) : [...current, event]
    );
  }

  function handleSave() {
    // Client-side webhook URL validation
    const webhookUrlTrimmed = webhookUrl.trim();
    if (webhookUrlTrimmed && !/^https?:\/\//i.test(webhookUrlTrimmed)) {
      showToast({
        title: "Ongeldige webhook URL",
        description: "Webhook URL moet beginnen met https:// of http://",
        variant: "error",
      });
      return;
    }

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
      ...(isWorkspaceOwner
        ? [
            { key: "bookings.google_service_account_private_key", value: googleServicePrivateKey },
            { key: "bookings.google_calendar_timezone", value: googleTimezone.trim() || "Europe/Brussels" },
            { key: "bookings.webhook_secret", value: webhookSecret },
          ]
        : []),
      { key: "bookings.default_approval_mode", value: approvalMode },
      { key: "bookings.webhook_url", value: webhookUrlTrimmed },
      { key: "bookings.webhook_events", value: webhookEvents.join(",") },
      { key: "bookings.reminders_24h_enabled", value: String(reminders24hEnabled) },
      { key: "bookings.reminders_1h_enabled", value: String(reminders1hEnabled) },
    ];

    batchUpdate.mutate(entries, {
      onSuccess: () => {
        setSnapshot(currentSnapshot);
        syncEmbedFromSettings.mutate();
        if (isWorkspaceOwner) {
          syncHostTimezone.mutate({ timezone: googleTimezone.trim() || "Europe/Brussels" });
        }
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Settings2 className="h-6 w-6" />
              Booking Instellingen
            </h1>
            <p className="text-sm text-muted-foreground">Embed, beschikbaarheid en Google synchronisatie.</p>
          </div>
          {hasChanges ? (
            <Button onClick={handleSave} disabled={batchUpdate.isPending} className="shrink-0">
              <Save className="mr-2 h-4 w-4" />
              {batchUpdate.isPending ? "Opslaan..." : "Instellingen opslaan"}
            </Button>
          ) : null}
        </div>
      </div>

      <OpenClawPageAssist pathname={pathname} />

      <BookingSetupChecklist
        googleDone={googleChecklistDone}
        googleDescription={
          googleChecklistDone
            ? `Verbonden als ${googleOauthEmail || "service account"}`
            : "Koppel je Google Agenda in de Google-tab"
        }
        availabilityDone={activeDayCount > 0}
        availabilityDescription={
          activeDayCount > 0 ? `${activeDayCount} dagen actief` : "Stel je beschikbare dagen in"
        }
        embedDone={embedChecklistDone}
        embedDescription={
          embedChecklistDone ? "Publieke link beschikbaar" : "Genereer je publieke token via de embed-tab"
        }
        automationsDone={automationsChecklistDone}
        automationsDescription={
          automationsChecklistDone
            ? approvalMode === "automatic"
              ? "Auto-bevestiging aan"
              : "Webhook geconfigureerd"
            : "Stel auto-bevestiging of webhook in"
        }
      />

      <div className="settings-stat-grid">
        <div className="settings-stat-card">
          <div className="h-1 bg-gradient-to-r from-amber-500/85 via-amber-500/35 to-transparent" />
          <div className="settings-stat-card-body">
            <div className="settings-stat-card-icon bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="settings-stat-card-label">Bookingflow</p>
              <p className="settings-stat-card-value">
                {meetingName || "Kennismaking"} · {duration} min
              </p>
              <p className="settings-stat-card-meta">
                {theme === "dark" ? "Donkere layout" : "Lichte layout"} · {brandName || "Digitify"}
              </p>
            </div>
          </div>
        </div>

        <div className="settings-stat-card">
          <div className="h-1 bg-gradient-to-r from-blue-500/85 via-blue-500/35 to-transparent" />
          <div className="settings-stat-card-body">
            <div className="settings-stat-card-icon bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400">
              <Globe2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="settings-stat-card-label">Beschikbaarheid</p>
              <p className="settings-stat-card-value">
                {availableDaysCsv
                  ? `${availableDaysCsv.split(",").length} actieve dagen`
                  : "Geen dagen actief"}
              </p>
              <p className="settings-stat-card-meta">
                {fallbackWindow.start} – {fallbackWindow.end} · slots {slotMinutes} min
              </p>
            </div>
          </div>
        </div>

        <div className="settings-stat-card">
          <div
            className={cn(
              "h-1 bg-gradient-to-r to-transparent",
              googleReady
                ? "from-emerald-500/85 via-emerald-500/35"
                : "from-amber-500/85 via-amber-500/35",
            )}
          />
          <div className="settings-stat-card-body">
            <div
              className={cn(
                "settings-stat-card-icon",
                googleReady
                  ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
              )}
            >
              {googleReady ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="settings-stat-card-label">Google Agenda</p>
              <p className="settings-stat-card-value">
                {googleReady ? "Live sync actief" : "Nog niet gekoppeld"}
              </p>
              <p className="settings-stat-card-meta">{googleConnectionLabel}</p>
            </div>
          </div>
        </div>

        <div className="settings-stat-card">
          <div
            className={cn(
              "h-1 bg-gradient-to-r to-transparent",
              hasChanges
                ? "from-amber-500/85 via-amber-500/35"
                : "from-emerald-500/85 via-emerald-500/35",
            )}
          />
          <div className="settings-stat-card-body items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="settings-stat-card-label">Opslagstatus</p>
              <p className="settings-stat-card-value">
                {hasChanges ? "Niet-opgeslagen wijzigingen" : "Alles opgeslagen"}
              </p>
              <p className="settings-stat-card-meta">
                {hasChanges
                  ? "Klik opslaan om wijzigingen te bewaren."
                  : "Booking- en Google-instellingen zijn gesynchroniseerd."}
              </p>
            </div>
            <Badge
              variant={hasChanges ? "warning" : "success"}
              className="shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
            >
              {hasChanges ? "Open" : "Saved"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.7fr)_minmax(420px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Booking Configuratie
            </CardTitle>
            <CardDescription>Publieke bookingflow en Google synchronisatie.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" asChild>
                <a href="/api/integrations/google-calendar/connect">
                  <Globe2 className="mr-2 h-4 w-4" />
                  {googleOauthEmail ? "Google Agenda opnieuw koppelen en auto-sync inschakelen" : "Google Agenda koppelen en auto-sync inschakelen"}
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
              <TabsList className="settings-domain-tabs settings-domain-tabs-cols-6">
                <TabsTrigger value="flow" className="settings-domain-tab">
                  <Zap className="settings-domain-tab-icon" />
                  Flow
                </TabsTrigger>
                <TabsTrigger value="availability" className="settings-domain-tab">
                  <Clock className="settings-domain-tab-icon" />
                  Beschikbaarheid
                </TabsTrigger>
                <TabsTrigger value="automations" className="settings-domain-tab">
                  <Webhook className="settings-domain-tab-icon" />
                  Automaties
                </TabsTrigger>
                <TabsTrigger value="google" className="settings-domain-tab">
                  <Globe2 className="settings-domain-tab-icon" />
                  Google
                </TabsTrigger>
                <TabsTrigger value="embed" className="settings-domain-tab">
                  <Code2 className="settings-domain-tab-icon" />
                  Embed
                </TabsTrigger>
                <TabsTrigger value="types" className="settings-domain-tab">
                  <Layers className="settings-domain-tab-icon" />
                  Boekingstypes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="flow" className="space-y-4 rounded-2xl border p-4">
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
                    <Label>Service (optioneel)</Label>
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
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tijdweergave</Label>
                    <Select value={timeMode} onValueChange={setTimeMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24u</SelectItem>
                        <SelectItem value="12">12 uur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold">Bevestigingsmodus</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setApprovalMode("manual")}
                      className={`rounded-xl border p-3 text-left transition ${
                        approvalMode === "manual"
                          ? "border-foreground/30 bg-muted"
                          : "border-border hover:border-foreground/20"
                      }`}
                    >
                      <p className="text-sm font-medium">Handmatige goedkeuring</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Elke boeking start als PENDING. Jij bevestigt manueel per boeking.
                      </p>
                      {approvalMode === "manual" ? (
                        <Badge variant="secondary" className="mt-2 text-xs">Actief</Badge>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovalMode("automatic")}
                      className={`rounded-xl border p-3 text-left transition ${
                        approvalMode === "automatic"
                          ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20"
                          : "border-border hover:border-foreground/20"
                      }`}
                    >
                      <p className="text-sm font-medium">Automatische bevestiging</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Boekingen worden direct CONFIRMED. Klant ontvangt meteen een kalenderuitnodiging.
                      </p>
                      {approvalMode === "automatic" ? (
                        <Badge variant="success" className="mt-2 text-xs">Actief</Badge>
                      ) : null}
                    </button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="availability" className="space-y-4 rounded-2xl border p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Kleur</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                      />
                      <Input value={color} onChange={(event) => setColor(event.target.value)} className="font-mono" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Duur (minuten)</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["15", "20", "30", "45", "60", "90", "120"].map((v) => (
                          <SelectItem key={v} value={v}>{v} min</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Slot interval</Label>
                    <Select value={slotMinutes} onValueChange={setSlotMinutes}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["15", "20", "30", "45", "60"].map((v) => (
                          <SelectItem key={v} value={v}>Elke {v} min</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Label>Beschikbaarheid per dag</Label>
                <div className="space-y-2">
                  {DAY_ROWS.map((day) => {
                    const enabled = weeklyHours[day.key].enabled;
                    return (
                      <div
                        key={day.key}
                        className={`grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                          enabled ? "border-border bg-background" : "border-border/40 bg-muted/20 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: enabled ? color : undefined }}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium">{day.short}</span>
                        </div>
                        <Input
                          type="time"
                          value={weeklyHours[day.key].start}
                          onChange={(event) => updateDay(day.key, { start: event.target.value })}
                          disabled={!enabled}
                        />
                        <Input
                          type="time"
                          value={weeklyHours[day.key].end}
                          onChange={(event) => updateDay(day.key, { end: event.target.value })}
                          disabled={!enabled}
                        />
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) => updateDay(day.key, { enabled: checked })}
                        />
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="automations" className="space-y-5 rounded-2xl border p-4">
                <Label className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-500" />
                  Herinneringen
                </Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">24u-herinnering</p>
                      <p className="text-xs text-muted-foreground">E-mail 24 uur voor de afspraak.</p>
                    </div>
                    <Switch
                      checked={reminders24hEnabled}
                      onCheckedChange={setReminders24hEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">1u-herinnering</p>
                      <p className="text-xs text-muted-foreground">E-mail 1 uur voor de afspraak.</p>
                    </div>
                    <Switch
                      checked={reminders1hEnabled}
                      onCheckedChange={setReminders1hEnabled}
                    />
                  </div>
                </div>

                <div className="border-t pt-5">
                  <Label className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-purple-500" />
                    Webhook integratie
                  </Label>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                      placeholder="https://jouw-server.nl/webhook/boekingen"
                      type="url"
                    />
                    <p className="text-xs text-muted-foreground">
                      Beveiligd met HMAC-SHA256 via header <code className="rounded bg-muted px-1">X-Digitify-Signature</code>.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook secret (optioneel)</Label>
                    {isWorkspaceOwner ? (
                      <Input
                        value={webhookSecret}
                        onChange={(event) => setWebhookSecret(event.target.value)}
                        type="password"
                        placeholder={
                          webhookSecretConfigured
                            ? "Nieuwe secret invullen om te vervangen"
                            : "Geheime sleutel voor handtekeningverificatie"
                        }
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Alleen de workspace-eigenaar kan de webhook secret bekijken of wijzigen.
                        {webhookSecretConfigured ? " Er is al een secret geconfigureerd." : null}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Actieve eventi (leeg = alle)</Label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_WEBHOOK_EVENTS.map((evt) => {
                        const active = webhookEvents.includes(evt);
                        return (
                          <button
                            key={evt}
                            type="button"
                            onClick={() => toggleWebhookEvent(evt)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                              active
                                ? "border-foreground/30 bg-foreground text-background"
                                : "border-border text-muted-foreground hover:border-foreground/30"
                            }`}
                          >
                            {evt}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {webhookEvents.length === 0
                        ? "Alle booking-eventi worden verstuurd."
                        : `Alleen ${webhookEvents.length} geselecteerde event${webhookEvents.length > 1 ? "s" : ""} worden verstuurd.`}
                    </p>
                  </div>
                  {webhookUrl.trim() ? (
                    <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-950/20">
                      <p className="text-xs font-medium text-purple-800 dark:text-purple-400">Webhook geconfigureerd — sla op om te activeren.</p>
                    </div>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="google" id="google-agenda" className="space-y-4 rounded-2xl border p-4">
                <p className="text-xs text-muted-foreground">
                  Redirect URL: <code className="rounded bg-muted px-1">{getAppUrl()}/api/integrations/google-calendar/callback</code>
                </p>
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
                    <Label>Tijdzone (alleen workspace-eigenaar)</Label>
                    <Select
                      value={resolveBookingTimezoneSelectValue(googleTimezone)}
                      onValueChange={setGoogleTimezone}
                      disabled={!isWorkspaceOwner}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kies tijdzone" />
                      </SelectTrigger>
                      <SelectContent>
                        {bookingTimezoneOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Bepaalt beschikbare slots, Google Agenda-sync en wat bezoekers in de embed zien.
                      {!isWorkspaceOwner ? " Alleen de workspace-eigenaar kan dit veld wijzigen." : null}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <Label>Synchronisatie actief</Label>
                  <Switch checked={googleSyncEnabled} onCheckedChange={setGoogleSyncEnabled} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="settings-connect-card">
                    <div className="h-1 bg-gradient-to-r from-blue-500/85 via-blue-500/30 to-transparent" />
                    <div className="settings-connect-card-body">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className="settings-connect-card-icon bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400">
                            <Globe2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold tracking-tight">OAuth koppeling</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Snelste manier: inloggen met Google en auto-sync inschakelen.
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={googleOauthEmail ? "success" : "secondary"}
                          className="shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {googleOauthEmail ? "Verbonden" : "Niet verbonden"}
                        </Badge>
                      </div>
                      {googleOauthEmail ? (
                        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-muted-foreground">
                          Actief als <span className="font-medium text-foreground">{googleOauthEmail}</span>
                        </p>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button type="button" className="shadow-sm sm:flex-1" asChild>
                          <a href="/api/integrations/google-calendar/connect">
                            <Globe2 className="mr-2 h-4 w-4" />
                            {googleOauthEmail ? "Opnieuw verbinden" : "Verbind met Google"}
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => testGoogleSync.mutate()}
                          disabled={testGoogleSync.isPending}
                          className="sm:shrink-0"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {testGoogleSync.isPending ? "Testen..." : "Test sync"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="settings-connect-card">
                    <div className="h-1 bg-gradient-to-r from-violet-500/85 via-violet-500/30 to-transparent" />
                    <div className="settings-connect-card-body">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className="settings-connect-card-icon bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400">
                            <Settings2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold tracking-tight">Service account</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Alternatief voor teams: koppel via service account credentials.
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            googleServiceAccountEmail.trim() &&
                            (googleServicePrivateKey.trim() || googleServicePrivateKeyConfigured)
                              ? "success"
                              : "secondary"
                          }
                          className="shrink-0 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {googleServiceAccountEmail.trim() &&
                          (googleServicePrivateKey.trim() || googleServicePrivateKeyConfigured)
                            ? "Ingevuld"
                            : "Optioneel"}
                        </Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Vul hieronder e-mail en private key in als je geen OAuth wilt gebruiken, bijvoorbeeld voor
                        server-side synchronisatie.
                      </p>
                    </div>
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
                {isWorkspaceOwner ? (
                  <div className="space-y-2">
                    <Label>Service account private key</Label>
                    <Textarea
                      value={googleServicePrivateKey}
                      onChange={(event) => setGoogleServicePrivateKey(event.target.value)}
                      rows={5}
                      placeholder={
                        googleServicePrivateKeyConfigured
                          ? "Nieuwe private key invullen om te vervangen"
                          : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                      }
                      className="font-mono text-xs"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Alleen de workspace-eigenaar kan de service account private key bekijken of wijzigen.
                    {googleServicePrivateKeyConfigured ? " Er is al een key geconfigureerd." : null}
                  </p>
                )}
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
                <div className="flex items-center justify-between gap-4">
                  <Label>Live preview</Label>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={bookingPreviewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Openen
                    </a>
                  </Button>
                </div>
                {publicTenantToken ? (
                  <div className="overflow-hidden rounded-2xl border bg-muted/20" style={{ height: 560 }}>
                    <iframe
                      key={bookingPreviewUrl}
                      src={bookingPreviewUrl}
                      className="h-full w-full"
                      style={{ border: 0 }}
                      title="Booking widget preview"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
                    <div>
                      <Globe2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">Geen tenant token</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Genereer een publiek token via de chatbot-instellingen om de live preview te activeren.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="types" className="space-y-4 rounded-2xl border p-4">
                <BookingEventTypeManager publicTenantToken={publicTenantToken} />
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
            <CardTitle className="text-base">Embed code</CardTitle>
            <CardDescription>Plak deze iframe-code op je website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-6">{embedCode}</pre>
              <Button type="button" variant="outline" size="sm" className="absolute right-3 top-3" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copied ? "Gekopieerd" : "Kopieer"}
              </Button>
            </div>
            <Button type="button" variant="outline" className="w-full" asChild>
              <a href={bookingPreviewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open live preview
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
