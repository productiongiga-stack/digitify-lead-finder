import { describe, expect, it, vi } from "vitest";
import {
  EMAIL_TEMPLATE_STARTER_PACK,
  seedEmailTemplateStarterPack,
} from "../lib/email-template-starter-pack";
import { templateRouter } from "../routers/template.router";

describe("email template starter pack", () => {
  it("exposes eight canonical templates (template.starterPack + seedStarterPack)", () => {
    expect(EMAIL_TEMPLATE_STARTER_PACK).toHaveLength(8);
    expect(EMAIL_TEMPLATE_STARTER_PACK.map((item) => item.name)).toContain("Intro — Modern outreach");
    expect(EMAIL_TEMPLATE_STARTER_PACK.every((item) => item.name && item.subject && item.body)).toBe(true);
  });

  it("creates only missing starter templates", async () => {
    const findMany = vi.fn().mockResolvedValue([{ name: "Intro — Modern outreach" }]);
    const createMany = vi.fn().mockResolvedValue({ count: 7 });
    const db = {
      emailTemplate: { findMany, createMany },
    } as any;

    const result = await seedEmailTemplateStarterPack(db, "workspace_1");

    expect(result.created).toBe(7);
    expect(result.total).toBe(8);
    expect(createMany).toHaveBeenCalledOnce();
    const payload = createMany.mock.calls[0][0].data;
    expect(payload.every((row: { createdById: string }) => row.createdById === "workspace_1")).toBe(true);
    expect(payload.some((row: { name: string }) => row.name === "Follow-up — Compact")).toBe(true);
  });

  it("returns zero created when pack already exists", async () => {
    const findMany = vi.fn().mockResolvedValue(
      EMAIL_TEMPLATE_STARTER_PACK.map((item) => ({ name: item.name })),
    );
    const createMany = vi.fn();
    const db = {
      emailTemplate: { findMany, createMany },
    } as any;

    const result = await seedEmailTemplateStarterPack(db, "workspace_1");

    expect(result).toEqual({ created: 0, total: 8 });
    expect(createMany).not.toHaveBeenCalled();
  });
});
