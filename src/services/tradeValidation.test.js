import { describe, expect, it, vi, beforeEach } from "vitest";
import { normalizeKenyanPhone, validMpesaCode } from "./tradeValidation";

describe("Kenyan settlement details", () => {
  it("normalizes local and international M-Pesa numbers to the same destination", () => {
    for (const phone of ["0712345678", "+254712345678", "254712345678", "+254 712 345 678"]) expect(normalizeKenyanPhone(phone)).toBe("0712345678");
    expect(normalizeKenyanPhone("0112345678")).toBe("0112345678");
  });
  it("rejects foreign, incomplete, and malformed payout numbers", () => {
    for (const phone of ["+255712345678", "071234", "0812345678", "07123456789", ""]) expect(normalizeKenyanPhone(phone)).toBeNull();
  });
  it("requires a complete M-Pesa code", () => {
    expect(validMpesaCode(" abc1234567 ")).toBe(true);
    for (const code of ["ABC123", "ABC12345678", "ABCDEFGHI!", ""]) expect(validMpesaCode(code)).toBe(false);
  });
});
