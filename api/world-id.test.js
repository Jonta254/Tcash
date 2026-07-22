import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HIGH_VALUE_ACTION,
  HIGH_VALUE_KES_THRESHOLD,
  extractNullifier,
  isPlausibleHighValueProof,
  signHighValueRequest,
  worldIdSigningConfigured,
} from "./_lib/worldId.js";

// A throwaway secp256k1 test key (well-known Hardhat account #0). Never a
// production signer — only exercises the signing path locally.
const TEST_SIGNING_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function validProof(overrides = {}) {
  return {
    protocol_version: "4.0",
    nonce: "a1b2c3",
    action: HIGH_VALUE_ACTION,
    environment: "production",
    user_presence_completed: true,
    responses: [
      {
        identifier: "proof_of_human",
        signal_hash: "0x0",
        proof: ["0x1", "0x2"],
        nullifier: "0x04e5f6abc",
        issuer_schema_id: 1,
        expires_at_min: 1756166400,
      },
    ],
    ...overrides,
  };
}

describe("isPlausibleHighValueProof", () => {
  it("accepts a well-formed v4 uniqueness proof", () => {
    expect(isPlausibleHighValueProof(validProof())).toBe(true);
  });

  it("rejects a non-4.0 protocol version", () => {
    expect(isPlausibleHighValueProof(validProof({ protocol_version: "3.0" }))).toBe(false);
  });

  it("rejects a missing or empty responses array", () => {
    expect(isPlausibleHighValueProof(validProof({ responses: [] }))).toBe(false);
    expect(isPlausibleHighValueProof(validProof({ responses: undefined }))).toBe(false);
  });

  it("rejects a response with no nullifier", () => {
    expect(
      isPlausibleHighValueProof(validProof({ responses: [{ identifier: "proof_of_human" }] })),
    ).toBe(false);
  });

  it("rejects a blank or non-object payload", () => {
    expect(isPlausibleHighValueProof(null)).toBe(false);
    expect(isPlausibleHighValueProof({})).toBe(false);
    expect(isPlausibleHighValueProof(validProof({ action: "" }))).toBe(false);
  });
});

describe("extractNullifier", () => {
  it("returns the first present nullifier", () => {
    expect(extractNullifier(validProof())).toBe("0x04e5f6abc");
  });

  it("returns null when no response carries a nullifier", () => {
    expect(extractNullifier(validProof({ responses: [{ identifier: "x" }] }))).toBe(null);
  });
});

describe("signHighValueRequest", () => {
  const originalKey = process.env.WORLD_ID_RP_SIGNING_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.WORLD_ID_RP_SIGNING_KEY;
    } else {
      process.env.WORLD_ID_RP_SIGNING_KEY = originalKey;
    }
  });

  it("throws when no signing key is configured", () => {
    delete process.env.WORLD_ID_RP_SIGNING_KEY;
    delete process.env.RP_SIGNING_KEY;
    expect(worldIdSigningConfigured()).toBe(false);
    expect(() => signHighValueRequest()).toThrow();
  });

  it("returns an RpContext shaped for the IDKit widget", () => {
    process.env.WORLD_ID_RP_SIGNING_KEY = TEST_SIGNING_KEY;
    expect(worldIdSigningConfigured()).toBe(true);

    const context = signHighValueRequest();

    expect(context).toHaveProperty("rp_id");
    expect(context.rp_id).toMatch(/^rp_/);
    expect(typeof context.nonce).toBe("string");
    expect(typeof context.signature).toBe("string");
    expect(Number.isFinite(context.created_at)).toBe(true);
    expect(Number.isFinite(context.expires_at)).toBe(true);
    // Snake_case timestamps and `signature` — the exact shape @worldcoin/idkit
    // consumes (RpContext), mapped from signRequest's camelCase return.
    expect(context.expires_at).toBeGreaterThan(context.created_at);
  });
});

describe("threshold + action constants", () => {
  it("exposes a positive KES threshold and the registered action", () => {
    expect(HIGH_VALUE_KES_THRESHOLD).toBeGreaterThan(0);
    expect(HIGH_VALUE_ACTION).toBe("high-value-order-check");
  });
});
