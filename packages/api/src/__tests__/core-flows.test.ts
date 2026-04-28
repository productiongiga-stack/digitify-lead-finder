import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { leadRouter } from "../routers/lead.router";
import { quoteRouter } from "../routers/quote.router";
import { bookingRouter } from "../routers/booking.router";
import { searchRouter } from "../routers/search.router";
import { invoiceRouter } from "../routers/invoice.router";
import { taskRouter } from "../routers/task.router";

function makeCtx(db: Record<string, unknown>) {
  return {
    db: db as any,
    user: {
      id: "user_abcd1234",
      email: "owner@example.com",
      name: "Owner",
      role: "OWNER",
    },
    requestId: "req_test",
  };
}

describe("lead flow", () => {
  it("creates a lead and writes activity metadata", async () => {
    const leadCreate = vi.fn().mockResolvedValue({
      id: "lead_1",
      companyName: "Acme BV",
      createdById: "user_abcd1234",
    });
    const activityCreate = vi.fn().mockResolvedValue({ id: "act_1" });
    const caller = leadRouter.createCaller(
      makeCtx({
        lead: { create: leadCreate },
        activity: { create: activityCreate },
      }),
    );

    const created = await caller.create({
      companyName: "Acme BV",
      city: "Gent",
      source: "manual",
    });

    expect(created.id).toBe("lead_1");
    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyName: "Acme BV",
          createdById: "user_abcd1234",
        }),
      }),
    );
    expect(activityCreate).toHaveBeenCalledTimes(1);
  });
});

describe("quote flow", () => {
  it("creates quote totals correctly from items", async () => {
    const quoteCount = vi.fn().mockResolvedValue(0);
    const leadFindFirst = vi.fn().mockResolvedValue(null);
    const quoteCreate = vi.fn().mockImplementation(async ({ data }: any) => ({
      id: "quote_1",
      ...data,
      lead: null,
      createdBy: { id: "user_abcd1234", name: "Owner" },
      items: data.items.create,
    }));
    const activityCreate = vi.fn().mockResolvedValue({ id: "act_2" });

    const caller = quoteRouter.createCaller(
      makeCtx({
        quote: { count: quoteCount, create: quoteCreate },
        lead: { findFirst: leadFindFirst },
        activity: { create: activityCreate },
      }),
    );

    const quote = await caller.create({
      clientName: "Client NV",
      clientEmail: "",
      vatRate: 21,
      items: [
        { name: "Website", quantity: 2, unitPrice: 500 },
        { name: "SEO", quantity: 1, unitPrice: 300 },
      ],
    });

    expect(quote.subtotal).toBe(1300);
    expect(quote.vatAmount).toBe(273);
    expect(quote.total).toBe(1573);
    expect(activityCreate).toHaveBeenCalledTimes(1);
  });
});

describe("booking flow", () => {
  it("rejects bookings in the past", async () => {
    const caller = bookingRouter.createCaller(makeCtx({}));
    await expect(
      caller.create({
        clientName: "Past User",
        clientEmail: "",
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        duration: 60,
      }),
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "BAD_REQUEST",
    });
  });
});

describe("api endpoint behavior", () => {
  it("calculates preview score for lead-search endpoint", async () => {
    const caller = searchRouter.createCaller(makeCtx({}));
    const result = await caller.previewScore({
      hasWebsite: false,
      rating: 3.2,
      reviewCount: 0,
    });
    expect(result).toEqual({ score: 90, priority: "Hot" });
  });
});

describe("lead import flow", () => {
  it("imports csv leads and skips duplicates", async () => {
    const leadFindMany = vi.fn().mockResolvedValue([
      { companyName: "Acme BV", email: "hello@acme.be" },
    ]);
    const leadCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const activityCreate = vi.fn().mockResolvedValue({ id: "act_3" });
    const caller = leadRouter.createCaller(
      makeCtx({
        lead: { findMany: leadFindMany, createMany: leadCreateMany },
        activity: { create: activityCreate },
      }),
    );

    const result = await caller.importCsv({
      csv: "company,email,city\nAcme BV,hello@acme.be,Gent\nNova Studio,info@nova.be,Antwerpen",
    });

    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(leadCreateMany).toHaveBeenCalledTimes(1);
  });
});

describe("invoice flow", () => {
  it("creates invoice from quote", async () => {
    const settingFindMany = vi.fn().mockResolvedValue([]);
    const settingUpsert = vi.fn().mockResolvedValue({ id: "setting_1" });
    const quoteFindFirst = vi.fn().mockResolvedValue({
      id: "quote_123",
      quoteNumber: "OFF-2026-TEST-0001",
      leadId: "lead_1",
      status: "ACCEPTED",
      clientName: "Client NV",
      clientEmail: "client@example.com",
      clientPhone: null,
      clientCompany: "Client NV",
      clientAddress: "Straat 1",
      clientVat: "BE0123456789",
      notes: "Bedankt",
      subtotal: 1000,
      vatRate: 21,
      vatAmount: 210,
      total: 1210,
      items: [
        { id: "item1", name: "Website", description: null, quantity: 1, unitPrice: 1000, total: 1000 },
      ],
    });
    const activityCreate = vi.fn().mockResolvedValue({ id: "act_9" });
    const caller = invoiceRouter.createCaller(
      makeCtx({
        setting: { findMany: settingFindMany, upsert: settingUpsert },
        quote: { findFirst: quoteFindFirst },
        activity: { create: activityCreate },
      }),
    );

    const created = await caller.createFromQuote({ quoteId: "quote_123" });
    expect(created.quoteId).toBe("quote_123");
    expect(created.total).toBe(1210);
    expect(settingUpsert).toHaveBeenCalled();
  });
});

describe("task flow", () => {
  it("creates task linked to lead", async () => {
    const settingFindMany = vi.fn().mockResolvedValue([]);
    const settingUpsert = vi.fn().mockResolvedValue({ id: "setting_2" });
    const leadFindFirst = vi.fn().mockResolvedValue({ id: "lead_1" });
    const caller = taskRouter.createCaller(
      makeCtx({
        setting: { findMany: settingFindMany, upsert: settingUpsert },
        lead: { findFirst: leadFindFirst },
      }),
    );

    const task = await caller.create({
      title: "Follow-up doen",
      relatedType: "LEAD",
      relatedId: "lead_1",
    });
    expect(task.title).toBe("Follow-up doen");
    expect(settingUpsert).toHaveBeenCalled();
  });
});
