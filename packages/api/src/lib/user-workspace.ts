import { type PrismaClient } from "@digitify/db";
import { ensurePublicTenantToken } from "./public-tenant";
import { ensureTenantSchemaCompatibility } from "./tenant-schema-compat";
import { userSettingKey } from "./user-settings";

const WORKSPACE_INIT_KEY = "workspace.initialized_v2";

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
      "",
      "[[LAYOUT=modern]]",
    ].join("\n"),
  },
  {
    name: "Follow-up - Opvolging",
    subject: "Even opvolgen op mijn bericht",
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
      "",
      "[[LAYOUT=followup]]",
    ].join("\n"),
  },
  {
    name: "Offerte - Samenvatting",
    subject: "Offerte {{quoteNumber}} voor {{companyName}}",
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
      "",
      "[[LAYOUT=proposal]]",
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

export async function ensureUserWorkspace(db: PrismaClient, userId: string, fallbackCompanyName?: string | null) {
  try {
    await ensureTenantSchemaCompatibility(db);
  } catch {
    // If schema auto-fix fails (permissions/network), we still run safe fallback below.
  }

  const initKey = userSettingKey(userId, WORKSPACE_INIT_KEY);
  const initialized = await db.setting.findUnique({
    where: { key: initKey },
    select: { key: true },
  });
  if (initialized) {
    await ensurePublicTenantToken(db, userId);
    return;
  }

  const companyName = fallbackCompanyName?.trim() || "Mijn bedrijf";
  const defaults: Array<{ key: string; value: string }> = [
    { key: "branding.company_name", value: companyName },
    { key: "branding.primary_color", value: "#f9ae5a" },
    { key: "chatbot.company_name", value: companyName },
    { key: "chatbot.primary_color", value: "#f9ae5a" },
    { key: "quotes.embed_color", value: "#f9ae5a" },
    { key: "bookings.embed_color", value: "#f9ae5a" },
  ];

  const applyBaseSettings = async (tx: Pick<PrismaClient, "setting">) => {
    await Promise.all(
      defaults.map((setting) =>
        tx.setting.upsert({
          where: { key: userSettingKey(userId, setting.key) },
          create: { key: userSettingKey(userId, setting.key), value: setting.value },
          update: { value: setting.value },
        }),
      ),
    );

    await tx.setting.upsert({
      where: { key: initKey },
      create: { key: initKey, value: "true" },
      update: { value: "true" },
    });
  };

  try {
    await db.$transaction(async (tx) => {
      const alreadyInitialized = await tx.setting.findUnique({
        where: { key: initKey },
        select: { key: true },
      });
      if (alreadyInitialized) return;

      await tx.pipelineStage.createMany({
        data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
          createdById: userId,
          name: stage.name,
          color: stage.color,
          sortOrder: stage.sortOrder,
          isDefault: stage.isDefault,
        })),
        skipDuplicates: true,
      });

      await tx.tag.createMany({
        data: DEFAULT_TAGS.map((tag) => ({
          createdById: userId,
          name: tag.name,
          color: tag.color,
        })),
        skipDuplicates: true,
      });

      await tx.emailTemplate.createMany({
        data: DEFAULT_EMAIL_TEMPLATES.map((template) => ({
          createdById: userId,
          name: template.name,
          subject: template.subject,
          body: template.body,
          isGlobal: false,
        })),
        skipDuplicates: true,
      });

      await tx.serviceCatalog.createMany({
        data: DEFAULT_SERVICE_CATALOG.map((service) => ({
          createdById: userId,
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

      await applyBaseSettings(tx);
    });
  } catch (error) {
    const maybeMessage =
      typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : "";
    const message = maybeMessage || String(error);
    const isMissingCreatedByColumn =
      message.includes("column `createdById` does not exist") ||
      message.includes('column "createdById" does not exist');
    if (!isMissingCreatedByColumn) throw error;

    console.warn("[workspace] falling back to legacy init because createdById columns are not available yet");
    await db.$transaction(async (tx) => {
      await applyBaseSettings(tx);
    });
  }

  await ensurePublicTenantToken(db, userId);
}
