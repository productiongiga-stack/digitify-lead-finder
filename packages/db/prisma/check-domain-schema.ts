import { PrismaClient } from "@prisma/client";

const requiredColumns = {
  domains: [
    "analysisData",
    "trackerData",
    "lastAnalyzedAt",
    "lastTrackerAt",
    "healthScore",
  ],
  registration_requests: ["targetWorkspaceOwnerId"],
} as const;

const prisma = new PrismaClient();

async function main() {
  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'domains' AND column_name IN ('analysisData', 'trackerData', 'lastAnalyzedAt', 'lastTrackerAt', 'healthScore'))
          OR (table_name = 'registration_requests' AND column_name = 'targetWorkspaceOwnerId'))
    `;
    const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = Object.entries(requiredColumns).flatMap(([table, columns]) =>
      columns.filter((column) => !present.has(`${table}.${column}`)).map((column) => `${table}.${column}`),
    );
    if (missing.length > 0) {
      throw new Error(`critical schema is missing: ${missing.join(", ")}`);
    }
    console.log("OK: domains insights schema is complete");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : "schema check failed"}`);
  process.exitCode = 1;
});
