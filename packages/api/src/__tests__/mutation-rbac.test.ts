import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { leadRouter } from "../routers/lead.router";
import { tagRouter } from "../routers/tag.router";
import { userRouter } from "../routers/user.router";
import { formRouter } from "../routers/form.router";
import { workflowRouter } from "../routers/workflow.router";

function viewerCtx(db: Record<string, unknown>) {
  const database = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "viewer_1", role: "VIEWER", workspaceOwnerId: "owner_1" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      ...db,
    } as any;
  database.$transaction = vi.fn(async (run: (tx: any) => unknown) => run(database));
  database.$executeRaw = vi.fn().mockResolvedValue(0);
  return {
    db: database,
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
    const database = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "member_1", role: "MEMBER", workspaceOwnerId: "owner_1" }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        lead: { create: leadCreate, findMany: vi.fn().mockResolvedValue([]) },
        activity: { create: vi.fn().mockResolvedValue({ id: "act_1" }) },
      } as any;
    database.$transaction = vi.fn(async (run: (tx: any) => unknown) => run(database));
    database.$executeRaw = vi.fn().mockResolvedValue(0);
    const caller = leadRouter.createCaller({
      db: database,
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

function adminModuleContext(targetRole: "ADMIN" | "MEMBER" | "OWNER" = "MEMBER") {
  const setting = {
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
  };
  const securityAuditEvent = { create: vi.fn().mockResolvedValue({ id: "audit_1" }) };
  const workspaceMembership = {
    findUnique: vi.fn().mockResolvedValue({ role: targetRole, status: "ACTIVE" }),
  };
  const user = {
    findUnique: vi.fn().mockResolvedValue({ id: "target_1", role: targetRole }),
    findFirst: vi.fn().mockResolvedValue(null),
  };

  return {
    db: { setting, securityAuditEvent, workspaceMembership, user } as any,
    user: {
      id: "admin_1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      workspaceId: "owner_1",
      workspaceRole: "ADMIN",
    },
    requestId: "req_admin_modules",
  };
}

describe("per-account module access", () => {
  it("allows an ADMIN to read and change modules for a non-owner account", async () => {
    const context = adminModuleContext("MEMBER");
    const caller = userRouter.createCaller(context);

    await expect(caller.getUserModules({ userId: "target_1" })).resolves.toEqual({ disabled: [] });
    await expect(caller.setUserModule({ userId: "target_1", module: "quotes", enabled: false }))
      .resolves.toEqual(expect.objectContaining({ success: true, disabled: ["quotes"] }));
    expect(context.db.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "user:target_1:modules.disabled" },
    }));
  });

  it("prevents an ADMIN from managing an OWNER account", async () => {
    const caller = userRouter.createCaller(adminModuleContext("OWNER"));

    await expect(caller.getUserModules({ userId: "target_1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.setUserModule({ userId: "target_1", module: "quotes", enabled: false }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents an account from changing its own module access", async () => {
    const context = adminModuleContext("ADMIN");
    context.user.id = "target_1";
    const caller = userRouter.createCaller(context);

    await expect(caller.setUserModule({ userId: "target_1", module: "quotes", enabled: false }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects module IDs outside the managed catalog", async () => {
    const caller = userRouter.createCaller(adminModuleContext("MEMBER"));

    await expect(caller.setUserModule({ userId: "target_1", module: "unknown-module", enabled: false } as any))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("form management RBAC", () => {
  it("allows an ADMIN to create a workspace form", async () => {
    const create = vi.fn().mockResolvedValue({ id: "form_1", name: "Contact", publicKey: "public_1", status: "DRAFT" });
    const caller = formRouter.createCaller({
      db: { leadForm: { create } } as any,
      user: { id: "admin_1", email: "admin@example.com", name: "Admin", role: "ADMIN", workspaceId: "owner_1", workspaceRole: "ADMIN" },
      requestId: "req_form_admin",
    });

    await expect(caller.create({ name: "Contact" })).resolves.toMatchObject({ id: "form_1" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: "owner_1" }) }));
  });

  it("blocks a MEMBER from creating a form", async () => {
    const caller = formRouter.createCaller({
      db: { leadForm: { create: vi.fn() } } as any,
      user: { id: "member_1", email: "member@example.com", name: "Member", role: "MEMBER", workspaceId: "owner_1", workspaceRole: "MEMBER" },
      requestId: "req_form_member",
    });

    await expect(caller.create({ name: "Contact" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("workflow management RBAC", () => {
  it("allows an ADMIN to create a task workflow", async () => {
    const create = vi.fn().mockResolvedValue({ id: "workflow_1", name: "Opvolging", status: "DRAFT" });
    const caller = workflowRouter.createCaller({
      db: { workflow: { create } } as any,
      user: { id: "admin_1", email: "admin@example.com", name: "Admin", role: "ADMIN", workspaceId: "owner_1", workspaceRole: "ADMIN" },
      requestId: "req_workflow_admin",
    });

    await expect(caller.create({ name: "Opvolging", trigger: "LEAD_CREATED", actions: [{ type: "CREATE_TASK", title: "Bel de lead" }] })).resolves.toMatchObject({ id: "workflow_1" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: "owner_1" }) }));
  });

  it("blocks workflow management during view-as", async () => {
    const caller = workflowRouter.createCaller({
      db: { workflow: { create: vi.fn() } } as any,
      user: { id: "member_1", email: "member@example.com", name: "Member", role: "MEMBER", workspaceId: "owner_1", workspaceRole: "ADMIN", isViewingAs: true },
      requestId: "req_workflow_view_as",
    });

    await expect(caller.create({ name: "Opvolging", trigger: "LEAD_CREATED", actions: [{ type: "CREATE_TASK", title: "Bel de lead" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
