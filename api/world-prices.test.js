import { describe, expect, it } from "vitest";
import { buildCoinGeckoRates, buildUsdKesRate, buildWorldRates, parseWorldMoney } from "./world-prices.js";

describe("market cross rates", () => {
  const now = () => Math.floor(Date.now() / 1000);
  it("uses the WLD identifier and actual USDC dollar value when KES is absent", () => {
    const rates = buildCoinGeckoRates({
      "worldcoin-wld": { usd: 0.55, last_updated_at: now() },
      "usd-coin": { usd: 0.999, last_updated_at: now() },
      worldcoin: { usd: 0.0026, last_updated_at: now() },
    }, 130);
    expect(rates.WLD).toBeCloseTo(71.5);
    expect(rates.USDC).toBeCloseTo(129.87);
  });
  it("rejects stale crypto prices and the unrelated worldcoin token", () => {
    expect(buildCoinGeckoRates({ worldcoin: { usd: 0.55, last_updated_at: now() } }, 130)).toBeNull();
    expect(buildCoinGeckoRates({
      "worldcoin-wld": { usd: 0.55, last_updated_at: now() - 1201 },
      "usd-coin": { usd: 1, last_updated_at: now() },
    }, 130)).toBeNull();
  });
  it("accepts a daily dollar exchange rate but refuses stale or wrong-base rates", () => {
    const payload = { result: "success", base_code: "USD", rates: { KES: 130 }, time_last_update_unix: now() - 86400 };
    expect(buildUsdKesRate(payload)).toBe(130);
    expect(buildUsdKesRate({ ...payload, base_code: "EUR" })).toBe(0);
    expect(buildUsdKesRate({ ...payload, time_last_update_unix: now() - 172801 })).toBe(0);
  });
});

// The exact shape World's public miniapp price feed returns. Captured from a
// live response — the previous code read `prices.WLD.KES` as a number, which
// on this object is NaN, so the feed never produced a usable rate and the
// endpoint 502'd once the other sources were geo-blocked or stale.
const liveWorldPayload = {
  result: {
    prices: {
      WLD: { KES: { asset: "KES", amount: "50444262334490", decimals: 12, symbol: "KES" } },
      USDC: { KES: { asset: "KES", amount: "129499171366282", decimals: 12, symbol: "KES" } },
    },
  },
};

describe("parseWorldMoney", () => {
  it("converts a fixed-point money object to its decimal value", () => {
    expect(parseWorldMoney({ amount: "50444262334490", decimals: 12 })).toBeCloseTo(50.44426233449, 8);
    expect(parseWorldMoney({ amount: "129499171366282", decimals: 12 })).toBeCloseTo(129.499171366282, 8);
  });

  it("handles decimals: 0 and numeric amounts", () => {
    expect(parseWorldMoney({ amount: 42, decimals: 0 })).toBe(42);
  });

  it("returns 0 for anything malformed rather than NaN", () => {
    expect(parseWorldMoney(undefined)).toBe(0);
    expect(parseWorldMoney({})).toBe(0);
    expect(parseWorldMoney({ amount: "abc", decimals: 12 })).toBe(0);
    expect(parseWorldMoney({ amount: "-5", decimals: 12 })).toBe(0);
    expect(parseWorldMoney({ amount: "1", decimals: -1 })).toBe(0);
    // A plain number (the shape the old code wrongly assumed) is not money.
    expect(parseWorldMoney(50.44)).toBe(0);
  });
});

describe("buildWorldRates", () => {
  it("reads both rates from a real World payload", () => {
    const rates = buildWorldRates(liveWorldPayload);
    expect(rates).not.toBeNull();
    expect(rates.WLD).toBeCloseTo(50.444, 3);
    expect(rates.USDC).toBeCloseTo(129.499, 3);
  });

  it("rejects a payload missing either asset", () => {
    expect(buildWorldRates({ result: { prices: {} } })).toBeNull();
    expect(
      buildWorldRates({
        result: { prices: { WLD: liveWorldPayload.result.prices.WLD } },
      }),
    ).toBeNull();
  });

  it("rejects sub-1 KES values as implausible rather than trusting them", () => {
    expect(
      buildWorldRates({
        result: {
          prices: {
            WLD: { KES: { amount: "1", decimals: 12 } },
            USDC: { KES: { amount: "1", decimals: 12 } },
          },
        },
      }),
    ).toBeNull();
  });

  it("returns null for an empty or malformed payload", () => {
    expect(buildWorldRates({})).toBeNull();
    expect(buildWorldRates(null)).toBeNull();
  });
});
