import { describe, expect, it } from "vitest";
import { priceOrder } from "./quote.js";
const market = { prices: { WLD: 100, USDC: 130 }, source: "test-feed", fetchedAt: "2026-10-06T00:00:00Z" };
describe("server trade quotes", () => {
  it("calculates buy quantities from market rates instead of a client claim", () => {
    const result = priceOrder({ type: "buy", asset: "WLD", kesAmount: 1100, cryptoAmount: 10000, feeKesAmount: 0 }, market, { feeKesPerCoin: { WLD: 10 } });
    expect(result.cryptoAmount).toBe(10); expect(result.feeKesAmount).toBe(100); expect(result.grossKesAmount).toBe(1000); expect(result.kesAmount).toBe(1100);
  });
  it("deducts the operator fee and freezes settlement routing for sells", () => {
    const result = priceOrder({ type: "sell", asset: "USDC", cryptoAmount: 2, kesAmount: 99999 }, market, { feeKesPerCoin: { USDC: 5 }, sellWalletAddress: "0xoperator" });
    expect(result.kesAmount).toBe(250); expect(result.feeKesAmount).toBe(10); expect(result.sellWalletAddress).toBe("0xoperator");
  });
  it("rejects quotes with no payout, invalid rates, or below-minimum sells", () => {
    expect(() => priceOrder({ type: "sell", asset: "WLD", cryptoAmount: 10 }, market, { feeKesPerCoin: { WLD: 100 } })).toThrow("valid quote");
    expect(() => priceOrder({ type: "sell", asset: "WLD", cryptoAmount: 1 }, market)).toThrow("1 USDC");
    expect(() => priceOrder({ type: "buy", asset: "WLD", kesAmount: Infinity }, market)).toThrow("positive");
  });
});
