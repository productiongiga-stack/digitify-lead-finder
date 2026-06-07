#!/usr/bin/env node
/**
 * Sync MuAPI model costs into packages/media-studio/src/model-costs.ts
 * Usage: node packages/media-studio/scripts/sync-model-costs.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COSTS_FILE = join(__dirname, "../src/model-costs.ts");
const checkOnly = process.argv.includes("--check");

const response = await fetch("https://api.muapi.ai/api/v1/models");
if (!response.ok) {
  console.error("Failed to fetch MuAPI catalog:", response.status);
  process.exit(1);
}

const payload = await response.json();
const entries = (payload.models ?? [])
  .filter((model) => typeof model.cost === "number" && model.name)
  .map((model) => [model.name, model.cost])
  .sort(([a], [b]) => a.localeCompare(b));

const body = entries.map(([name, cost]) => `  "${name}": ${cost},`).join("\n");
const current = readFileSync(COSTS_FILE, "utf8");
const formatterStart = current.indexOf("export const USD_TO_EUR_RATE");
const formatterTail = formatterStart >= 0 ? current.slice(formatterStart) : "";
const generated = `/** Auto-generated from MuAPI /api/v1/models — run sync-model-costs.mjs to refresh */\nexport const MODEL_COST_USD: Record<string, number> = {\n${body}\n};\n\n${formatterTail}`;

if (checkOnly) {
  if (generated.trim() !== current.trim()) {
    console.error("model-costs.ts is out of sync with MuAPI catalog. Run sync-model-costs.mjs");
    process.exit(1);
  }
  console.log(`OK — ${entries.length} endpoints in sync`);
  process.exit(0);
}

writeFileSync(COSTS_FILE, generated, "utf8");
console.log(`Updated ${entries.length} model costs in model-costs.ts`);
