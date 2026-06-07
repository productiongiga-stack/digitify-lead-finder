import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "../lib/run-idempotent-sql";

describe("splitSqlStatements", () => {
  it("keeps DO $$ blocks together", () => {
    const sql = `
DO $$ BEGIN
  CREATE TYPE "Foo" AS ENUM ('A');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bar" ("id" TEXT NOT NULL);
`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("DO $$ BEGIN");
    expect(statements[1]).toContain('CREATE TABLE IF NOT EXISTS "bar"');
  });
});
