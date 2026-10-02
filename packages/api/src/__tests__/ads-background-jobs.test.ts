import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../lib/ads-workflow", () => ({ adJson: (v: unknown) => v, safeAdError: (e: Error) => e.message,
  loadOptimizationSettings: vi.fn(), syncAdAccount: vi.fn(), optimizeAds: vi.fn() }));
vi.mock("../lib/ads-workflow-providers", () => ({ adProviderConfig: vi.fn(), readAdAccount: vi.fn(), publishAdChanges: vi.fn() }));
import * as workflow from "../lib/ads-workflow";
import * as providers from "../lib/ads-workflow-providers";
import { enqueueAdsJobs, processAdsJobs, recoverAdsJobLeases } from "../lib/ads-background-jobs";

function dbMock(jobs: any[] = []) {
  const db: any = { adBackgroundJob: {
    upsert: vi.fn(async ({ create }) => ({ ...create, id: create.kind })),
    findMany: vi.fn(async ({ where }) => where.status === "RUNNING" ? [] : jobs),
    findFirst: vi.fn(async () => ({ status: "SUCCEEDED" })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  }, aiOptimizationRun: { findFirst: vi.fn(async () => null) },
    adSyncOperation: { updateMany: vi.fn(async () => ({ count: 0 })) },
    adChangeSet: { findMany: vi.fn(async () => []) }, adApprovalRequest: { findMany: vi.fn(async () => []) },
  };
  db.$transaction = async (fn: any) => fn(db);
  return db;
}
const job = (kind: string, extra = {}) => ({ id: "job", createdById: "owner", provider: "GOOGLE", kind, attempts: 0, dedupeKey: "owner:google:daily", ...extra });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(workflow.loadOptimizationSettings).mockResolvedValue({ enabled: true, maxBudgetChangePercent: 20, targetCpl: null, targetRoas: null });
  vi.mocked(workflow.syncAdAccount).mockResolvedValue({ versions: [], errors: [], truncated: false });
  vi.mocked(workflow.optimizeAds).mockResolvedValue({ id: "run" } as any);
});
describe("duurzame advertentie-achtergrondtaken", () => {
  it("plant aparte taken met dagelijkse deduplicatie en sync-dependency", async () => {
    const db = dbMock();
    await enqueueAdsJobs(db, "owner", "GOOGLE", new Date("2026-10-02T12:00:00Z"));
    expect(db.adBackgroundJob.upsert).toHaveBeenCalledTimes(5);
    expect(db.adBackgroundJob.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ kind: "OPTIMIZE", dependencyId: "SYNC", createdById: "owner" }), update: {} }));
  });
  it("plant zonder opt-in uitsluitend lokale herstel- en herinneringstaken", async () => {
    vi.mocked(workflow.loadOptimizationSettings).mockResolvedValue({ enabled: false } as any);
    const db = dbMock(); await enqueueAdsJobs(db, "owner", "GOOGLE");
    expect(db.adBackgroundJob.upsert.mock.calls.map(([arg]: any) => arg.create.kind)).toEqual(["RECOVERY", "REMINDERS"]);
  });
  it("claimt een taak atomair en publiceert nooit advertenties", async () => {
    const db = dbMock([job("SYNC")]); await processAdsJobs(db, "owner", Date.now() + 120000);
    expect(db.adBackgroundJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "job", createdById: "owner", status: "PENDING", attempts: 0 }),
      data: expect.objectContaining({ status: "RUNNING", leaseToken: expect.any(String) }) }));
    expect(providers.publishAdChanges).not.toHaveBeenCalled();
  });
  it("voert een reeds geclaimde taak niet uit", async () => {
    const db = dbMock([job("SYNC")]); db.adBackgroundJob.updateMany.mockResolvedValue({ count: 0 });
    await processAdsJobs(db, "owner", Date.now() + 120000);
    expect(workflow.syncAdAccount).not.toHaveBeenCalled();
  });
  it("blokkeert AI wanneer de synchronisatie mislukt is", async () => {
    const db = dbMock([job("OPTIMIZE", { dependencyId: "sync" })]); db.adBackgroundJob.findFirst.mockResolvedValue({ status: "FAILED" });
    await processAdsJobs(db, "owner", Date.now() + 120000);
    expect(workflow.optimizeAds).not.toHaveBeenCalled();
    expect(db.adBackgroundJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED" }) }));
  });
  it("herplant uitsluitend veilige tijdelijke reads met backoff", async () => {
    const db = dbMock([job("SYNC")]); vi.mocked(workflow.syncAdAccount).mockRejectedValue(new Error("503 network"));
    await processAdsJobs(db, "owner", Date.now() + 120000);
    expect(db.adBackgroundJob.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", runAt: expect.any(Date), leaseToken: null }) }));
  });
  it("herhaalt een onzekere AI-run niet", async () => {
    const db = dbMock([job("OPTIMIZE")]); db.aiOptimizationRun.findFirst.mockResolvedValue({ status: "RUNNING" });
    await processAdsJobs(db, "owner", Date.now() + 120000);
    expect(workflow.optimizeAds).not.toHaveBeenCalled();
    expect(db.adBackgroundJob.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
  it("een verlopen AI-lease vraagt controle, maar reads kunnen hervatten", async () => {
    const db = dbMock(); db.adBackgroundJob.findMany.mockResolvedValue([job("OPTIMIZE", { leaseToken: "old" }), job("SYNC", { id: "sync", leaseToken: "safe" })]);
    await recoverAdsJobLeases(db, "owner");
    expect(db.adBackgroundJob.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ leaseToken: "old", createdById: "owner" }), data: expect.objectContaining({ status: "NEEDS_REVIEW" }) }));
    expect(db.adBackgroundJob.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }));
  });
  it("annuleert externe reads wanneer de workspace de planning uitzet", async () => {
    vi.mocked(workflow.loadOptimizationSettings).mockResolvedValue({ enabled: false } as any);
    const db = dbMock([job("SYNC")]); await processAdsJobs(db, "owner", Date.now() + 120000);
    expect(workflow.syncAdAccount).not.toHaveBeenCalled();
    expect(db.adBackgroundJob.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) }));
  });
});
