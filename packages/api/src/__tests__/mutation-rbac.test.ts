import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { leadRouter } from "../routers/lead.router";
import { tagRouter } from "../routers/tag.router";

function viewerCtx(db: Record<string, unknown>) {
  return {
    db: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "viewer_1", role: "VIEWER", workspaceOwnerId: "owner_1" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      ...db,
    } as any,
    user: {
      id: "viewer_1",
      email: "viewer@example.com",
      name: "Viewer",
      role: "VIEWER",
      workspaceId: "owner_1",
    },
    requestId: "req_viewer",
  };
}

describe("mutationProcedure RBAC", () => {
  it("VIEWER cannot delete a lead", async () => {
    const caller = leadRouter.createCaller(
      viewerCtx({
        lead: { delete: vi.fn() },
      }),
    );

    await expect(caller.delete({ id: "lead_1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("VIEWER cannot create a lead", async () => {
    const caller = leadRouter.createCaller(
      viewerCtx({
        lead: { create: vi.fn() },
        activity: { create: vi.fn() },
      }),
    );

    await expect(
      caller.create({ companyName: "Acme", city: "Gent", source: "manual" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("VIEWER can still list leads", async () => {
    const leadFindMany = vi.fn().mockResolvedValue([]);
    const caller = leadRouter.createCaller(
      viewerCtx({
        lead: { findMany: leadFindMany, count: vi.fn().mockResolvedValue(0) },
      }),
    );

    await expect(caller.list({ page: 1, pageSize: 10 })).resolves.toEqual(
      expect.objectContaining({ items: [], total: 0 }),
    );
    expect(leadFindMany).toHaveBeenCalled();
  });

  it("TESTER cannot create tags", async () => {
    const caller = tagRouter.createCaller({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "tester_1", role: "TESTER", workspaceOwnerId: "owner_1" }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        tag: { create: vi.fn() },
      } as any,
      user: {
        id: "tester_1",
        email: "tester@example.com",
        name: "Tester",
        role: "TESTER",
        workspaceId: "owner_1",
      },
      requestId: "req_tester",
    });

    await expect(caller.create({ name: "Hot", color: "#f00" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("MEMBER can create a lead", async () => {
    const leadCreate = vi.fn().mockResolvedValue({
      id: "lead_1",
      companyName: "Acme BV",
      createdById: "owner_1",
    });
    const caller = leadRouter.createCaller({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "member_1", role: "MEMBER", workspaceOwnerId: "owner_1" }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        lead: { create: leadCreate },
        activity: { create: vi.fn().mockResolvedValue({ id: "act_1" }) },
      } as any,
      user: {
        id: "member_1",
        email: "member@example.com",
        name: "Member",
        role: "MEMBER",
        workspaceId: "owner_1",
      },
      requestId: "req_member",
    });

    const created = await caller.create({ companyName: "Acme BV", city: "Gent", source: "manual" });
    expect(created.id).toBe("lead_1");
    expect(leadCreate).toHaveBeenCalled();
  });
});
