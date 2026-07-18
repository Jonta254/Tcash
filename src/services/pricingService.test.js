import { describe, expect, it } from "vitest";
import {
  calculateBuyRate,
  calculateKesWalletBalance,
  calculateSellRate,
  formatCryptoAmount,
  formatKES,
} from "./pricingService";

describe("calculateBuyRate", () => {
  it("adds the fee on top of the market price", () => {
    expect(calculateBuyRate(120, 10)).toBe(130);
  });

  it("never goes negative even with a huge negative fee", () => {
    expect(calculateBuyRate(10, -50)).toBe(0);
  });

  it("treats missing inputs as zero rather than NaN", () => {
    expect(calculateBuyRate(undefined, undefined)).toBe(0);
  });
});

describe("calculateSellRate", () => {
  it("subtracts the fee from the market price", () => {
    expect(calculateSellRate(120, 10)).toBe(110);
  });

  it("floors at zero when the fee exceeds the market price", () => {
    // The one case that matters most for a payout flow: a misconfigured
    // fee must never produce a negative payout amount.
    expect(calculateSellRate(5, 10)).toBe(0);
  });
});

describe("formatKES", () => {
  it("always shows exactly two decimal places", () => {
    expect(formatKES(600)).toBe("KES 600.00");
    expect(formatKES(1234.5)).toBe("KES 1,234.50");
  });

  it("treats a missing amount as zero, not KES NaN", () => {
    expect(formatKES(undefined)).toBe("KES 0.00");
  });
});

describe("formatCryptoAmount", () => {
  it("trims trailing zeros within the fraction-digit cap", () => {
    expect(formatCryptoAmount(4.2)).toBe("4.2");
    expect(formatCryptoAmount(4)).toBe("4");
  });

  it("respects a custom fraction-digit cap", () => {
    expect(formatCryptoAmount(1.23456789, 2)).toBe("1.23");
  });
});

describe("calculateKesWalletBalance", () => {
  it("sums each asset's balance at its own live rate", () => {
    const assets = [
      { symbol: "WLD", formattedBalance: "10" },
      { symbol: "USDC", formattedBalance: "5" },
    ];
    const rates = { WLD: 120, USDC: 128 };
    // 10*120 + 5*128 = 1200 + 640
    expect(calculateKesWalletBalance(assets, rates)).toBe(1840);
  });

  it("treats an asset with no live rate as worth zero, not a crash", () => {
    const assets = [{ symbol: "UNKNOWN", formattedBalance: "10" }];
    expect(calculateKesWalletBalance(assets, {})).toBe(0);
  });
});
