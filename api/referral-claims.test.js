import { describe, expect, it } from "vitest";
import { isClaimRecord, normalizeWallet } from "./referral-claims.js";

const validClaim = {
  id: "claim-123",
  referralCode: "TC-JONTAWORLD",
  referrerUsername: "jontaworld",
  referrerLabel: "Tcash referrer",
  referrerMpesaPhoneNumber: "0712345678",
  referrerWalletAddress: "0xabc1234567890abcdef1234567890abcdef1234",
  milestoneUsers: 6,
  rewardKes: 100,
  status: "pending",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("isClaimRecord", () => {
  it("accepts a minimally valid claim", () => {
    expect(isClaimRecord(validClaim)).toBe(true);
  });

  it("rejects a status outside the known set", () => {
    expect(isClaimRecord({ ...validClaim, status: "refunded" })).toBe(false);
  });

  it("rejects a non-finite reward or milestone", () => {
    expect(isClaimRecord({ ...validClaim, rewardKes: Number.NaN })).toBe(false);
    expect(isClaimRecord({ ...validClaim, milestoneUsers: Infinity })).toBe(false);
  });

  it("rejects a missing id", () => {
    expect(isClaimRecord({ ...validClaim, id: "" })).toBe(false);
  });

  it("rejects an oversized free-text field", () => {
    expect(isClaimRecord({ ...validClaim, referrerLabel: "x".repeat(1000) })).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isClaimRecord(null)).toBe(false);
    expect(isClaimRecord("claim-123")).toBe(false);
  });
});

describe("normalizeWallet", () => {
  it("lowercases and trims", () => {
    expect(normalizeWallet("  0xABC123  ")).toBe("0xabc123");
  });

  it("returns an empty string for a missing address", () => {
    expect(normalizeWallet(null)).toBe("");
    expect(normalizeWallet(undefined)).toBe("");
  });
});
