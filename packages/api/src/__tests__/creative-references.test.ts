import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@digitify/db";
import { loadReferenceLibrary } from "../lib/creative-references";
describe("Creative reference library persistence", () => {
  it("reads stored JSON through the settings parser without losing references", async () => {
    const items = [
      {
        id: "image",
        url: "https://cdn.muapi.ai/reference.png",
        filename: "reference.png",
        contentType: "image/png",
        createdAt: "2026-10-06T00:00:00Z",
      },
    ];
    const findMany = vi
      .fn()
      .mockResolvedValue([
        {
          key: "workspace:test:creative.reference_library",
          value: JSON.stringify(items),
        },
      ]);
    const db = { setting: { findMany } } as unknown as PrismaClient;
    expect(await loadReferenceLibrary(db, "test")).toEqual(items);
    expect(await loadReferenceLibrary(db, "test")).toEqual(items);
  });
});
