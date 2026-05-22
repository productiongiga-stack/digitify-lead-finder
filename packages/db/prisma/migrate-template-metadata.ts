/**
 * Backfill EmailTemplate metadata columns from legacy [[TAG]] markers in body.
 * Run after applying migration: pnpm --filter @digitify/db db:migrate-metadata
 */
import { PrismaClient, EmailTemplateLayout, EmailTemplateType } from "@prisma/client";

const LAYOUT_VALUES = new Set<string>(["modern", "minimal", "business", "proposal", "followup"]);
const TYPE_VALUES = new Set<string>([
  "OUTREACH",
  "FOLLOW_UP",
  "PROPOSAL",
  "REPORT",
  "BOOKING",
  "REVIEW",
  "REENGAGEMENT",
  "CUSTOM",
]);

function matchTag(body: string, key: string) {
  return body.match(new RegExp(`\\[\\[${key}=(.+?)\\]\\]`, "i"))?.[1]?.trim() || "";
}

function stripTag(body: string, key: string) {
  return body.replace(new RegExp(`\\n?\\[\\[${key}=.+?\\]\\]`, "gi"), "");
}

function extractLegacyMetadata(body: string) {
  const rawLayout = matchTag(body, "LAYOUT").toLowerCase();
  const rawType = matchTag(body, "TYPE").toUpperCase();
  const cleanBody = ["CTA_TEXT", "CTA_URL", "LAYOUT", "TYPE", "DESCRIPTION"]
    .reduce((acc, key) => stripTag(acc, key), body)
    .trim();

  return {
    cleanBody,
    layout: LAYOUT_VALUES.has(rawLayout) ? (rawLayout as EmailTemplateLayout) : EmailTemplateLayout.modern,
    type: TYPE_VALUES.has(rawType) ? (rawType as EmailTemplateType) : EmailTemplateType.CUSTOM,
    description: matchTag(body, "DESCRIPTION"),
    ctaText: matchTag(body, "CTA_TEXT"),
    ctaUrl: matchTag(body, "CTA_URL"),
  };
}

async function main() {
  const prisma = new PrismaClient();
  const templates = await prisma.emailTemplate.findMany({
    select: { id: true, body: true, type: true, layout: true },
  });

  let updated = 0;
  for (const template of templates) {
    const hasTags = /\[\[(CTA_TEXT|CTA_URL|LAYOUT|TYPE|DESCRIPTION)=/i.test(template.body);
    if (!hasTags) continue;

    const meta = extractLegacyMetadata(template.body);
    await prisma.emailTemplate.update({
      where: { id: template.id },
      data: {
        body: meta.cleanBody,
        type: meta.type,
        layout: meta.layout,
        description: meta.description,
        ctaText: meta.ctaText,
        ctaUrl: meta.ctaUrl,
      },
    });
    updated += 1;
  }

  console.log(`Migrated ${updated} of ${templates.length} email templates.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
