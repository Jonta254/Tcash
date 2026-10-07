import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pay: vi.fn(), confirm: vi.fn(), reference: vi.fn() }));
vi.mock("@worldcoin/minikit-js", () => ({ MiniKit: { isInstalled: () => true, commandsAsync: { pay: mocks.pay } } }));
vi.mock("./backendService", () => ({ createPaymentReference: mocks.reference, confirmWorldPayment: mocks.confirm, completeSiweVerification: vi.fn(), requestServerNonce: vi.fn() }));
import { requestWorldPayment } from "./worldAppService";
describe("World payment recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.reference.mockResolvedValue({ reference: "ref-one" });
    mocks.pay.mockResolvedValue({ finalPayload: { status: "success", transaction_id: "tx-one", reference: "ref-one" } });
    mocks.confirm.mockResolvedValue({ verified: false, submitted: true, transactionStatus: "pending" });
  });
  it("awaits durable recovery before checking chain status", async () => {
    let saved = false;
    mocks.confirm.mockImplementation(async () => {
      expect(saved).toBe(true);
      return { verified: false, submitted: true, transactionStatus: "pending" };
    });
    const result = await requestWorldPayment({ amount: 3, to: "0xabc", onSubmitted: async payload => {
      expect(payload.transactionId).toBe("tx-one");
      await Promise.resolve(); saved = true;
    } });
    expect(result.transactionStatus).toBe("pending");
    expect(result.verified).toBe(false);
  });
  it("retains the original command result when recovery storage fails", async () => {
    const recovery = vi.fn(async () => { throw new Error("store unavailable"); });
    await expect(requestWorldPayment({ amount: 3, to: "0xabc", onSubmitted: recovery })).rejects.toThrow("store unavailable");
    expect(recovery).toHaveBeenCalledWith(expect.objectContaining({ transactionId: "tx-one" }));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.pay).toHaveBeenCalledOnce();
  });
});
