import { type PrismaClient } from "@digitify/db";
import { ensurePublicTenantToken } from "./public-tenant";
import { userSettingKey } from "./user-settings";
import { workspaceSettingKey } from "./workspace-settings";

const WORKSPACE_INIT_KEY = "workspace.initialized_v2";
const WORKSPACE_CACHE_TTL_MS = 10 * 60 * 1000;
const workspaceCache = new Map<string, number>();

const DEFAULT_PIPELINE_STAGES = [
  { name: "Nieuw", color: "#f9ae5a", sortOrder: 0, isDefault: true },
  { name: "Gereviewd", color: "#8b5cf6", sortOrder: 1, isDefault: false },
  { name: "Gecontacteerd", color: "#3b82f6", sortOrder: 2, isDefault: false },
  { name: "Gekwalificeerd", color: "#10b981", sortOrder: 3, isDefault: false },
  { name: "Offerte", color: "#f59e0b", sortOrder: 4, isDefault: false },
  { name: "Gewonnen", color: "#22c55e", sortOrder: 5, isDefault: false },
  { name: "Verloren", color: "#ef4444", sortOrder: 6, isDefault: false },
] as const;

const DEFAULT_TAGS = [
  { name: "Hot lead", color: "#ef4444" },
  { name: "Warm lead", color: "#f59e0b" },
  { name: "Cold lead", color: "#64748b" },
  { name: "Webdesign", color: "#3b82f6" },
  { name: "SEO", color: "#8b5cf6" },
  { name: "Marketing", color: "#06b6d4" },
] as const;

const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: "Lead Contact - Eerste bericht",
    subject: "Korte intro voor {{companyName}}",
    type: "OUTREACH" as const,
    layout: "modern" as const,
    body: [
      "Beste {{contactName}},",
      "",
      "Ik zag dat {{companyName}} actief is in {{industry}} en ik wou kort contact opnemen.",
      "We helpen bedrijven zoals het uwe met gerichte verbeteringen in zichtbaarheid en conversie.",
      "",
      "Is een korte kennismaking deze week haalbaar?",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
  },
  {
    name: "Follow-up - Opvolging",
    subject: "Even opvolgen op mijn bericht",
    type: "FOLLOW_UP" as const,
    layout: "followup" as const,
    body: [
      "Beste {{contactName}},",
      "",
      "Ik volg kort op mijn vorige bericht.",
      "Past dit momenteel binnen jullie prioriteiten bij {{companyName}}?",
      "",
      "Ik licht het graag in 10 minuten toe.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
  },
  {
    name: "Offerte - Samenvatting",
    subject: "Offerte {{quoteNumber}} voor {{companyName}}",
    type: "PROPOSAL" as const,
    layout: "proposal" as const,
    body: [
      "Beste {{contactName}},",
      "",
      "Hierbij bezorgen we uw offerte met een duidelijke samenvatting.",
      "Totaalprijs: {{offerPrice}}",
      "",
      "Laat gerust weten welke onderdelen je eerst wil opstarten.",
      "",
      "Vriendelijke groeten,",
      "{{senderName}}",
    ].join("\n"),
  },
] as const;

const DEFAULT_SERVICE_CATALOG = [
  {
    category: "webdesign",
    name: "Website basis",
    description: "Snelle, professionele website met sterke basisstructuur.",
    basePrice: 1490,
    unit: "per project",
    sortOrder: 0,
  },
  {
    category: "marketing",
    name: "SEO kickstart",
    description: "Technische optimalisaties en lokale zichtbaarheid.",
    basePrice: 690,
    unit: "per maand",
    sortOrder: 1,
  },
  {
    category: "extras",
    name: "Maandelijkse optimalisatie",
    description: "Doorlopende verbeteringen en rapportage.",
    basePrice: 290,
    unit: "per maand",
    sortOrder: 2,
  },
] as const;

function workspaceInitKeys(workspaceId: string) {
  return [
    workspaceSettingKey(workspaceId, WORKSPACE_INIT_KEY),
    userSettingKey(workspaceId, WORKSPACE_INIT_KEY),
  ];
}

function readErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function isWorkspaceSeedRecoverableError(message: string) {
  return (
    message.includes("column `createdById` does not exist") ||
    message.includes('column "createdById" does not exist') ||
    /foreign key constraint/i.test(message)
  );
}

async function hasWorkspaceInitialization(
  db: Pick<PrismaClient, "setting">,
  workspaceId: string,
) {
  const initialized = await db.setting.findFirst({
    where: { key: { in: workspaceInitKeys(workspaceId) } },
    select: { key: true },
  });
  return Boolean(initialized);
}

async function seedWorkspaceEntities(
  tx: Pick<
    PrismaClient,
    "pipelineStage" | "tag" | "emailTemplate" | "serviceCatalog"
  >,
  workspaceId: string,
) {
  await tx.pipelineStage.createMany({
    data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
      createdById: workspaceId,
      name: stage.name,
      color: stage.color,
      sortOrder: stage.sortOrder,
      isDefault: stage.isDefault,
    })),
    skipDuplicates: true,
  });

  await tx.tag.createMany({
    data: DEFAULT_TAGS.map((tag) => ({
      createdById: workspaceId,
      name: tag.name,
      color: tag.color,
    })),
    skipDuplicates: true,
  });

  await tx.emailTemplate.createMany({
    data: DEFAULT_EMAIL_TEMPLATES.map((template) => ({
      createdById: workspaceId,
      name: template.name,
      subject: template.subject,
      body: template.body,
      type: template.type,
      layout: template.layout,
      isGlobal: false,
    })),
    skipDuplicates: true,
  });

  await tx.serviceCatalog.createMany({
    data: DEFAULT_SERVICE_CATALOG.map((service) => ({
      createdById: workspaceId,
      category: service.category,
      name: service.name,
      description: service.description,
      basePrice: service.basePrice,
      unit: service.unit,
      sortOrder: service.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

async function applyWorkspaceBaseSettings(
  tx: Pick<PrismaClient, "setting">,
  workspaceId: string,
  fallbackCompanyName?: string | null,
) {
  const companyName = fallbackCompanyName?.trim() || "Mijn bedrijf";
  const defaults: Array<{ key: string; value: string }> = [
    { key: "branding.company_name", value: companyName },
    { key: "branding.primary_color", value: "#f9ae5a" },
    { key: "chatbot.company_name", value: companyName },
    { key: "chatbot.primary_color", value: "#f9ae5a" },
    { key: "quotes.embed_color", value: "#f9ae5a" },
    { key: "bookings.embed_color", value: "#f9ae5a" },
  ];

  await Promise.all(
    defaults.map((setting) => {
      const scopedKey = workspaceSettingKey(workspaceId, setting.key);
      return tx.setting.upsert({
        where: { key: scopedKey },
        create: { key: scopedKey, value: setting.value },
        update: { value: setting.value },
      });
    }),
  );
}

async function markWorkspaceInitialized(
  tx: Pick<PrismaClient, "setting">,
  workspaceId: string,
) {
  const initKey = workspaceSettingKey(workspaceId, WORKSPACE_INIT_KEY);
  await tx.setting.upsert({
    where: { key: initKey },
    create: { key: initKey, value: "true" },
    update: { value: "true" },
  });
}

async function applySettingsOnlyInitialization(
  db: PrismaClient,
  workspaceId: string,
  fallbackCompanyName?: string | null,
) {
  await db.$transaction(async (tx) => {
    if (await hasWorkspaceInitialization(tx, workspaceId)) return;
    await applyWorkspaceBaseSettings(tx, workspaceId, fallbackCompanyName);
    await markWorkspaceInitialized(tx, workspaceId);
  });
}

/**
 * Ensure default workspace settings and starter data exist for the active workspace.
 * `workspaceId` is the tenant scope id (personal workspace id === user id, team workspace uses its own id).
 */
export async function ensureUserWorkspace(
  db: PrismaClient,
  workspaceId: string,
  fallbackCompanyName?: string | null,
) {
  const cachedAt = workspaceCache.get(workspaceId);
  if (cachedAt && Date.now() - cachedAt < WORKSPACE_CACHE_TTL_MS) return;

  if (await hasWorkspaceInitialization(db, workspaceId)) {
    await ensurePublicTenantToken(db, workspaceId);
    workspaceCache.set(workspaceId, Date.now());
    return;
  }

  try {
    await db.$transaction(async (tx) => {
      if (await hasWorkspaceInitialization(tx, workspaceId)) return;

      await seedWorkspaceEntities(tx, workspaceId);
      await applyWorkspaceBaseSettings(tx, workspaceId, fallbackCompanyName);
      await markWorkspaceInitialized(tx, workspaceId);
    });
  } catch (error) {
    const message = readErrorMessage(error);
    if (!isWorkspaceSeedRecoverableError(message)) throw error;

    console.warn(
      "[workspace] entity seed failed, applying settings-only initialization",
      { workspaceId, message },
    );
    await applySettingsOnlyInitialization(db, workspaceId, fallbackCompanyName);
  }

  await ensurePublicTenantToken(db, workspaceId);
  workspaceCache.set(workspaceId, Date.now());
}
