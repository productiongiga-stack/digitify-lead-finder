#!/usr/bin/env node
/**
 * Compare MuAPI catalog with packages/media-studio/src/models.ts endpoints.
 * Usage: node packages/media-studio/scripts/sync-models-from-muapi.mjs [--check]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_FILE = join(__dirname, "../src/models.ts");
const checkOnly = process.argv.includes("--check");

const response = await fetch("https://api.muapi.ai/api/v1/models");
if (!response.ok) {
  console.error("Failed to fetch MuAPI catalog:", response.status);
  process.exit(1);
}

const payload = await response.json();
const remoteNames = new Set(
  (payload.models ?? [])
    .map((model) => model?.name)
    .filter((name) => typeof name === "string"),
);

const source = readFileSync(MODELS_FILE, "utf8");
const localEndpoints = new Set(
  [...source.matchAll(/endpoint:\s*"([^"]+)"/g)].map((match) => match[1]),
);

const missingLocally = [...remoteNames].filter((name) => !localEndpoints.has(name)).sort();
const missingRemotely = [...localEndpoints].filter((name) => !remoteNames.has(name)).sort();

const report = [
  `MuAPI models: ${remoteNames.size}`,
  `Local endpoints: ${localEndpoints.size}`,
  `Missing locally (${missingLocally.length}):`,
  ...missingLocally.slice(0, 40).map((name) => `  - ${name}`),
  missingLocally.length > 40 ? `  ... and ${missingLocally.length - 40} more` : "",
  `Local-only (${missingRemotely.length}):`,
  ...missingRemotely.map((name) => `  - ${name}`),
].join("\n");

if (checkOnly) {
  if (missingLocally.length > 0) {
    console.error(report);
    console.error("\nCatalog drift detected. Review models.ts against MuAPI.");
    process.exit(1);
  }
  console.log(`OK — ${localEndpoints.size} local endpoints, no missing MuAPI models in first pass`);
  process.exit(0);
}

console.log(report);
