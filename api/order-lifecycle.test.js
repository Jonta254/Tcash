import { describe, expect, it } from "vitest";
import { assertOrderUpdate } from "./orders.js";
const wallet = "0xabc123";
const draft = { id: "one", type: "buy", asset: "WLD", cryptoAmount: 5, kesAmount: 600, userWalletAddress: wallet, walletAddress: wallet, status: "pending", createdAt: "2026-10-06T00:00:00Z" };

describe("immutable order lifecycle", () => {
  it("lets the owner submit a payment against the original quote", () => {
    expect(() => assertOrderUpdate(draft, { ...draft, status: "paid", paymentReference: "ABC1234567" }, wallet, false)).not.toThrow();
  });
  it("blocks overwriting an existing foreign order by reasserting ownership in the body", () => {
    expect(() => assertOrderUpdate({ ...draft, userWalletAddress: "0xother", walletAddress: "0xother" }, draft, wallet, false)).toThrow("does not belong");
  });
  it("prevents changing the amount or payout details after creation", () => {
    for (const change of [{ cryptoAmount: 50 }, { kesAmount: 2000 }, { walletAddress: "0xother" }, { payoutPhoneNumber: "0712345678" }]) expect(() => assertOrderUpdate(draft, { ...draft, ...change }, wallet, false)).toThrow("cannot change");
  });
  it("never reopens settled orders, even for an operator", () => {
    expect(() => assertOrderUpdate({ ...draft, status: "completed" }, draft, wallet, true)).toThrow("cannot be reopened");
  });
  it("keeps an already submitted payment reference fixed", () => {
    const paid = { ...draft, status: "paid", paymentReference: "ABC1234567" };
    expect(() => assertOrderUpdate(paid, { ...paid, paymentReference: "DEF1234567" }, wallet, false)).toThrow("cannot be replaced");
    expect(() => assertOrderUpdate(paid, { ...paid, status: "pending" }, wallet, false)).toThrow("cannot be reset");
  });
  it("rejects malformed payments and out-of-range buys", () => {
    expect(() => assertOrderUpdate(null, { ...draft, kesAmount: 20001 }, wallet, false)).toThrow("between");
    expect(() => assertOrderUpdate(null, { ...draft, status: "paid" }, wallet, false)).toThrow("requires a reference");
    expect(() => assertOrderUpdate(null, { ...draft, paymentReference: "short" }, wallet, false)).toThrow("M-Pesa code");
  });
});
