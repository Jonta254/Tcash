import { describe, expect, it } from "vitest";
import { assertOrderUpdate } from "./orders.js";
import { reviewError } from "../shared/orderReview.js";

const wallet = "0x1111111111111111111111111111111111111111";
const tx = "0x" + "a".repeat(64);
const sell = { id: "sell", type: "sell", asset: "WLD", cryptoAmount: 3, kesAmount: 200, payoutPhoneNumber: "0712345678", userWalletAddress: wallet, status: "paid", paymentReference: tx };
const buy = { ...sell, id: "buy", type: "buy", kesAmount: 600, paymentReference: "ABC1234567" };

describe("operator settlement and rejection evidence", () => {
  it("requires the outgoing M-Pesa code for a sell settlement", () => {
    for (const settlementReference of ["", "short", tx]) expect(reviewError(sell, "completed", { settlementReference })).toContain("M-Pesa payout code");
    expect(() => assertOrderUpdate(sell, { ...sell, status: "completed", settlementReference: "DEF1234567" }, wallet, true)).not.toThrow();
  });
  it("requires a delivery hash for buy settlement and rejects the incoming reference", () => {
    expect(reviewError(buy, "completed", { settlementReference: "DEF1234567" })).toContain("transaction hash");
    expect(reviewError(buy, "completed", { settlementReference: tx })).toBe("");
    expect(reviewError(sell, "completed", { settlementReference: tx })).not.toBe("");
    const same = { ...buy, paymentReference: tx };
    expect(reviewError(same, "completed", { settlementReference: tx })).toContain("outgoing");
  });
  it("does not let pending orders skip review", () => {
    expect(() => assertOrderUpdate({ ...sell, status: "pending" }, { ...sell, status: "completed", settlementReference: "DEF1234567" }, wallet, true)).toThrow("before marking");
  });
  it("requires a useful bounded rejection reason on the server", () => {
    for (const rejectionReason of ["", "bad", "x".repeat(501)]) expect(() => assertOrderUpdate(sell, { ...sell, status: "rejected", rejectionReason }, wallet, true)).toThrow("reason");
    expect(() => assertOrderUpdate(sell, { ...sell, status: "rejected", rejectionReason: "Payment amount does not match the saved quote." }, wallet, true)).not.toThrow();
  });
  it("blocks customers from supplying operator settlement metadata", () => {
    expect(() => assertOrderUpdate(sell, { ...sell, settlementReference: "DEF1234567" }, wallet, false)).toThrow("review details");
    expect(() => assertOrderUpdate(sell, { ...sell, reviewedBy: wallet }, wallet, false)).toThrow("review details");
  });
  it("locks review evidence after closure", () => {
    const closed = { ...sell, status: "completed", settlementReference: "DEF1234567" };
    expect(() => assertOrderUpdate(closed, { ...closed, settlementReference: "GHI1234567" }, wallet, true)).toThrow("review details");
  });
  it("accepts valid incoming codes to move pending orders to review", () => {
    expect(reviewError({ ...buy, status: "pending", paymentReference: "" }, "paid", { paymentReference: "ABC1234567" })).toBe("");
    expect(reviewError({ ...sell, status: "pending", paymentReference: "" }, "paid", { paymentReference: tx })).toBe("");
    expect(reviewError({ ...sell, status: "pending", paymentReference: "" }, "paid", { paymentReference: "not-a-hash" })).toContain("World Chain");
  });
});
