import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sync: vi.fn(), read: vi.fn(), write: vi.fn(), notify: vi.fn() }));
vi.mock("./backendService", () => ({ syncAdminOrder: mocks.sync, syncAdminOrders: mocks.sync, fetchAdminOrderQueue: vi.fn() }));
vi.mock("./localStorage", () => ({ readStorage: mocks.read, writeStorage: mocks.write }));
vi.mock("./authService", () => ({ getCurrentUser: () => ({ id: "user", walletAddress: "0xabc" }) }));
vi.mock("./notificationService", () => ({ notifyAdminOrderCreated: mocks.notify, notifyAdminReferralEvent: mocks.notify, notifyWorldUserOrderCreated: mocks.notify, notifyWorldUserOrderStatus: mocks.notify }));
vi.mock("./referralService", () => ({ evaluateReferralRewards: vi.fn(), findReferrerByCode: vi.fn(), markReferralMilestonesAnnounced: vi.fn() }));
import { commitPaidOrder } from "./orderService";
const draft = { id: "same-order", createdAt: "2026-10-06T00:00:00Z", status: "pending" };
describe("durable payment acknowledgment", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.read.mockReturnValue([]); mocks.notify.mockResolvedValue({}); });
  it("does not cache success or notify when the desk rejects a payment", async () => {
    mocks.sync.mockRejectedValue(new Error("Server unavailable"));
    await expect(commitPaidOrder(draft, { paymentReference: "ABC1234567" })).rejects.toThrow("unavailable");
    expect(mocks.write).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("keeps the same order and reference when retrying acceptance", async () => {
    mocks.sync.mockResolvedValue({ ok: true });
    const result = await commitPaidOrder(draft, { paymentReference: "ABC1234567" });
    expect(result.id).toBe(draft.id); expect(result.status).toBe("paid");
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.sync.mock.calls[0][0].paymentReference).toBe("ABC1234567");
  });
});

describe("server history reconciliation", () => {
  it("prefers settled server history over a stale future-dated cache", async () => {
    mocks.read.mockReturnValue([{ id: "one", status: "pending", updatedAt: "2099-01-01" }]);
    const { mergeAdminOrders } = await import("./orderService");
    const result = mergeAdminOrders([{ id: "one", status: "completed", updatedAt: "2026-10-06" }]);
    expect(result[0].status).toBe("completed");
  });
  it("preserves an unsynced command reference while accepting the server quote", async () => {
    mocks.read.mockReturnValue([{ id: "one", status: "pending", cryptoAmount: 100, paymentReference: "tx-command", paymentMethod: "world-pay" }]);
    const { mergeAdminOrders } = await import("./orderService");
    const result = mergeAdminOrders([{ id: "one", status: "pending", cryptoAmount: 5, paymentReference: "" }]);
    expect(result[0].cryptoAmount).toBe(5); expect(result[0].paymentReference).toBe("tx-command");
  });
});
