import { z } from "zod";

const PLACEHOLDER_SECRETS = new Set(["change-me-in-production", ""]);

function emptyToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isTestRuntime() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    process.env.VITEST === "1"
  );
}

const coreServerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

const productionServerEnvSchema = z.object({
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .min(32, "SETTINGS_ENCRYPTION_KEY must be at least 32 characters")
    .refine((value) => !PLACEHOLDER_SECRETS.has(value), {
      message: "SETTINGS_ENCRYPTION_KEY must not use the placeholder value",
    }),
  CRON_SECRET: z.string().min(16, "CRON_SECRET is required in production"),
  ENABLE_WORKSPACE_RLS: z.literal("true", {
    errorMap: () => ({
      message: "ENABLE_WORKSPACE_RLS must be true in production for tenant isolation",
    }),
  }),
});

export type CoreServerEnv = z.infer<typeof coreServerEnvSchema>;
export type ProductionServerEnv = z.infer<typeof productionServerEnvSchema>;
export type ValidatedServerEnv = CoreServerEnv & Partial<ProductionServerEnv>;

let cachedEnv: ValidatedServerEnv | null = null;

export function formatZodEnvError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "env";
    return `  - ${path}: ${issue.message}`;
  });
  return [
    "Invalid environment configuration:",
    ...lines,
    "",
    "Copy .env.example to .env.local (or set vars in your host) and restart the server.",
  ].join("\n");
}

function warnDevOptionalKeys() {
  if (isProduction() || isTestRuntime()) return;
  if (!process.env.SETTINGS_ENCRYPTION_KEY?.trim()) {
    console.warn(
      "[env] SETTINGS_ENCRYPTION_KEY is unset — sensitive settings fall back to NEXTAUTH_SECRET in development only.",
    );
  }
  if (!process.env.REDIS_URL?.trim() && !process.env.UPSTASH_REDIS_REST_URL?.trim()) {
    console.warn(
      "[env] REDIS_URL / Upstash REST not set — rate limits are in-memory (single instance only).",
    );
  }
}

/**
 * Validates required server environment variables. Skips strict checks in test unless force=true.
 */
export function validateServerEnv(options?: { force?: boolean }): ValidatedServerEnv {
  if (cachedEnv && !options?.force) return cachedEnv;
  if (isTestRuntime() && !options?.force) {
    cachedEnv = {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://test@localhost:5432/test",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "test-nextauth-secret-min-32-chars!!",
    };
    return cachedEnv;
  }

  const core = coreServerEnvSchema.safeParse(process.env);
  if (!core.success) {
    throw new Error(formatZodEnvError(core.error));
  }

  if (isProduction()) {
    const production = productionServerEnvSchema.safeParse(process.env);
    if (!production.success) {
      const issues = production.error.issues;
      const onlyMissingRls =
        issues.length === 1 && issues[0]?.path[0] === "ENABLE_WORKSPACE_RLS";
      if (onlyMissingRls) {
        console.error(
          "[env] CRITICAL: ENABLE_WORKSPACE_RLS is not true — workspace RLS is disabled in production. Set ENABLE_WORKSPACE_RLS=true in Vercel.",
        );
        cachedEnv = core.data;
        return cachedEnv;
      }
      throw new Error(formatZodEnvError(production.error));
    }
    cachedEnv = { ...core.data, ...production.data };
    return cachedEnv;
  }

  warnDevOptionalKeys();
  cachedEnv = core.data;
  return cachedEnv;
}

/** @deprecated Use validateServerEnv — kept for existing imports */
export function assertServerEnv() {
  validateServerEnv();
}

export function resetServerEnvCache() {
  cachedEnv = null;
}
