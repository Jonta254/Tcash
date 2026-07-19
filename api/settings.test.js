import { describe, expect, it } from "vitest";
import { isBoundedString, isValidFee, sanitizeSettingsPayload } from "./settings.js";

describe("isBoundedString", () => {
  it("accepts a normal non-empty string", () => {
    expect(isBoundedString("542542")).toBe(true);
  });

  it("rejects an empty or whitespace-only string", () => {
    expect(isBoundedString("")).toBe(false);
    expect(isBoundedString("   ")).toBe(false);
  });

  it("rejects a string past the length ceiling", () => {
    expect(isBoundedString("x".repeat(300))).toBe(false);
  });
});

describe("isValidFee", () => {
  it("accepts zero and a normal positive fee", () => {
    expect(isValidFee(0)).toBe(true);
    expect(isValidFee(10)).toBe(true);
  });

  it("rejects a negative fee", () => {
    expect(isValidFee(-1)).toBe(false);
  });

  it("rejects a non-finite value", () => {
    expect(isValidFee(Number.NaN)).toBe(false);
    expect(isValidFee(Infinity)).toBe(false);
  });

  it("rejects a fee past the sanity ceiling", () => {
    expect(isValidFee(100_001)).toBe(false);
  });
});

describe("sanitizeSettingsPayload — only known fields ever reach the shared document", () => {
  it("accepts and trims known string fields", () => {
    const result = sanitizeSettingsPayload({ mpesaPaybillNumber: "  542542  " });
    expect(result).toEqual({ mpesaPaybillNumber: "542542" });
  });

  it("silently drops unknown fields rather than storing them", () => {
    const result = sanitizeSettingsPayload({ mpesaPaybillNumber: "542542", isAdmin: true, __proto__: {} });
    expect(result).toEqual({ mpesaPaybillNumber: "542542" });
    expect(result.isAdmin).toBeUndefined();
  });

  it("throws on an invalid known string field", () => {
    expect(() => sanitizeSettingsPayload({ mpesaPaybillNumber: "" })).toThrow();
  });

  it("accepts a valid feeKesPerCoin object", () => {
    const result = sanitizeSettingsPayload({ feeKesPerCoin: { WLD: 10, USDC: 12.5 } });
    expect(result).toEqual({ feeKesPerCoin: { WLD: 10, USDC: 12.5 } });
  });

  it("throws on an invalid fee within feeKesPerCoin", () => {
    expect(() => sanitizeSettingsPayload({ feeKesPerCoin: { WLD: -5 } })).toThrow();
  });

  it("returns an empty object for a payload with nothing valid", () => {
    expect(sanitizeSettingsPayload({})).toEqual({});
  });
});
