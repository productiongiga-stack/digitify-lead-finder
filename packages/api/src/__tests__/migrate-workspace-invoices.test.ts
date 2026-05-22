import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/user-json-setting", () => ({
  readWorkspaceJsonSetting: vi.fn(),
}));

import { readWorkspaceJsonSetting } from "../lib/user-json-setting";
import { migrateLegacyWorkspaceInvoices } from "../lib/migrate-workspace-invoices";

describe("migrateLegacyWorkspaceInvoices", () => {
  beforeEach(() => {
    vi.mocked(readWorkspaceJsonSetting).mockReset();
  });

  it("imports legacy JSON invoices when table is empty", async () => {
    vi.mocked(readWorkspaceJsonSetting).mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "INV-2026-ABCD-0001",
        quoteId: null,
        leadId: null,
        clientName: "Klant BV",
        clientEmail: "a@b.be",
        clientCompany: null,
        clientAddress: null,
        clientVat: null,
        status: "DRAFT",
        issueDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-15T00:00:00.000Z",
        subtotal: 100,
        vatRate: 21,
        vatAmount: 21,
        total: 121,
        currency: "EUR",
        paymentReference: "+++123+++",
        notes: null,
        reminderCount: 0,
        lastReminderAt: null,
        paidAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        items: [
          {
            id: "line-1",
            name: "Dienst",
            description: null,
            quantity: 1,
            unitPrice: 100,
            total: 100,
          },
        ],
      },
    ]);

    const db = {
      workspaceInvoice: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "inv-1" }),
      },
    };

    const result = await migrateLegacyWorkspaceInvoices(db as any, {
      workspaceId: "ws-1",
      memberId: "ws-1",
    });

    expect(result.imported).toBe(1);
    expect(db.workspaceInvoice.create).toHaveBeenCalled();
  });
});
