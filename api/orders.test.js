import { describe, expect, it } from "vitest";
import { isOrderRecord, isSaneAmount, normalizeOrders, orderBelongsToWallet, sortOrders } from "./orders.js";

const validOrder = {
  id: "order-123",
  type: "buy",
  asset: "WLD",
  cryptoAmount: 4.2,
  kesAmount: 600,
};

describe("isOrderRecord", () => {
  it("accepts a minimally valid order", () => {
    expect(isOrderRecord(validOrder)).toBe(true);
  });

  it("rejects a type that isn't buy or sell", () => {
    expect(isOrderRecord({ ...validOrder, type: "swap" })).toBe(false);
  });

  it("rejects negative or infinite amounts", () => {
    expect(isOrderRecord({ ...validOrder, kesAmount: -1 })).toBe(false);
    expect(isOrderRecord({ ...validOrder, cryptoAmount: Infinity })).toBe(false);
    expect(isOrderRecord({ ...validOrder, kesAmount: Number.NaN })).toBe(false);
  });

  it("rejects an oversized free-text field", () => {
    expect(isOrderRecord({ ...validOrder, userLabel: "x".repeat(1000) })).toBe(false);
  });

  it("rejects a missing id", () => {
    expect(isOrderRecord({ ...validOrder, id: "" })).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isOrderRecord(null)).toBe(false);
    expect(isOrderRecord("order-123")).toBe(false);
  });
});

describe("isSaneAmount", () => {
  it("accepts zero (a fresh draft order before an amount is entered)", () => {
    expect(isSaneAmount(0)).toBe(true);
  });

  it("rejects an amount past the sanity ceiling", () => {
    expect(isSaneAmount(1_000_000_001)).toBe(false);
  });
});

describe("normalizeOrders", () => {
  it("filters out invalid records from a batch", () => {
    const result = normalizeOrders({ orders: [validOrder, { garbage: true }] });
    expect(result).toEqual([validOrder]);
  });

  it("caps a batch at 20 orders even if more are sent", () => {
    const oversizedBatch = Array.from({ length: 50 }, (_, i) => ({
      ...validOrder,
      id: `order-${i}`,
    }));
    const result = normalizeOrders({ orders: oversizedBatch });
    expect(result.length).toBe(20);
  });

  it("wraps a single `order` field into an array", () => {
    expect(normalizeOrders({ order: validOrder })).toEqual([validOrder]);
  });
});

describe("sortOrders", () => {
  it("sorts most-recently-updated first", () => {
    const older = { ...validOrder, id: "a", updatedAt: "2026-01-01T00:00:00Z" };
    const newer = { ...validOrder, id: "b", updatedAt: "2026-06-01T00:00:00Z" };
    expect([older, newer].sort(sortOrders)).toEqual([newer, older]);
  });

  it("falls back to createdAt when updatedAt is absent", () => {
    const older = { ...validOrder, id: "a", createdAt: "2026-01-01T00:00:00Z" };
    const newer = { ...validOrder, id: "b", createdAt: "2026-06-01T00:00:00Z" };
    expect([older, newer].sort(sortOrders)).toEqual([newer, older]);
  });
});

describe("orderBelongsToWallet — ownership enforcement", () => {
  const wallet = "0xabc1234567890abcdef1234567890abcdef1234";

  it("matches on userWalletAddress (the field set at draft-build time)", () => {
    const order = { ...validOrder, userWalletAddress: wallet.toUpperCase() };
    expect(orderBelongsToWallet(order, wallet)).toBe(true);
  });

  it("matches on walletAddress (a buy order's destination) too", () => {
    const order = { ...validOrder, walletAddress: wallet };
    expect(orderBelongsToWallet(order, wallet)).toBe(true);
  });

  it("is case-insensitive", () => {
    const order = { ...validOrder, userWalletAddress: wallet };
    expect(orderBelongsToWallet(order, wallet.toUpperCase())).toBe(true);
  });

  it("rejects a different wallet", () => {
    const order = { ...validOrder, userWalletAddress: wallet };
    expect(orderBelongsToWallet(order, "0x000000000000000000000000000000000000ff")).toBe(false);
  });

  it("rejects when the caller wallet is empty (never authenticated)", () => {
    const order = { ...validOrder, userWalletAddress: wallet };
    expect(orderBelongsToWallet(order, "")).toBe(false);
    expect(orderBelongsToWallet(order, null)).toBe(false);
  });

  it("rejects an order with no wallet fields at all against any caller", () => {
    const order = { ...validOrder };
    expect(orderBelongsToWallet(order, wallet)).toBe(false);
  });
});
