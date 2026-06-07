import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@digitify/db";

const DUPLICATE_CODES = new Set(["42710", "42P07", "23505"]);

function isIgnorableSqlError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("already exists")
    || message.includes("duplicate key")
    || DUPLICATE_CODES.has(message)
    || message.includes("42710")
    || message.includes("42P07")
  );
}

/** Splits SQL on semicolons while keeping DO $$ ... $$ blocks intact. */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = "";
  let index = 0;

  while (index < sql.length) {
    if (sql.startsWith("$$", index)) {
      const end = sql.indexOf("$$", index + 2);
      if (end === -1) {
        buffer += sql.slice(index);
        break;
      }
      buffer += sql.slice(index, end + 2);
      index = end + 2;
      continue;
    }

    const char = sql[index]!;
    if (char === ";") {
      const statement = buffer.trim();
      if (statement.replace(/--.*$/gm, "").trim()) {
        statements.push(statement);
      }
      buffer = "";
      index += 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  const tail = buffer.trim();
  if (tail.replace(/--.*$/gm, "").trim()) {
    statements.push(tail);
  }

  return statements;
}

export function resolveManualSqlPath(fileName: string): string | null {
  const candidates = [
    join(process.cwd(), "packages/db/prisma/manual", fileName),
    join(process.cwd(), "../../packages/db/prisma/manual", fileName),
    join(process.cwd(), "../../../packages/db/prisma/manual", fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export async function runIdempotentSql(
  db: PrismaClient,
  sql: string,
  label: string,
): Promise<{ label: string; executed: number; skipped: number }> {
  const statements = splitSqlStatements(sql);
  let executed = 0;
  let skipped = 0;

  for (const statement of statements) {
    try {
      await db.$executeRawUnsafe(statement);
      executed += 1;
    } catch (error) {
      if (isIgnorableSqlError(error)) {
        skipped += 1;
        continue;
      }
      const preview = statement.replace(/\s+/g, " ").slice(0, 120);
      throw new Error(`${label}: ${preview} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { label, executed, skipped };
}

export async function runManualSqlFile(
  db: PrismaClient,
  fileName: string,
): Promise<{ label: string; executed: number; skipped: number }> {
  const path = resolveManualSqlPath(fileName);
  if (!path) {
    throw new Error(`SQL-bestand niet gevonden: ${fileName}`);
  }

  const sql = readFileSync(path, "utf8");
  return runIdempotentSql(db, sql, fileName);
}
