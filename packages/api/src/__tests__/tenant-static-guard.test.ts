import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []);
}

describe("tenant static guard", () => {
  it("does not reintroduce the workspace-id-as-user-owner pattern", () => {
    const source = files(join(__dirname, "..")).filter((file) => !file.includes("__tests__"));
    const matches = source.flatMap((file) => readFileSync(file, "utf8").split("\n").map((line, index) => line.includes("createdById: ctx.user.workspaceId") ? `${file}:${index + 1}` : null).filter(Boolean));
    expect(matches).toEqual([]);
  });
});
