import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-do-not-use-in-prod";
});

const { createUserSessionToken, verifyUserSessionToken } = await import("./userSession.js");

const WALLET = "0xAbC1234567890abcdef1234567890ABCDEF1234";

describe("createUserSessionToken / verifyUserSessionToken", () => {
  it("round-trips a valid token back to the lowercase wallet address", () => {
    const token = createUserSessionToken(WALLET);
    const result = verifyUserSessionToken(token);
    expect(result.valid).toBe(true);
    expect(result.walletAddress).toBe(WALLET.toLowerCase());
  });

  it("rejects a token with a tampered signature", () => {
    const token = createUserSessionToken(WALLET);
    const tampered = token.slice(0, -4) + "xxxx";
    expect(verifyUserSessionToken(tampered).valid).toBe(false);
  });

  it("rejects a token claiming a different wallet than it was signed for", () => {
    // Forge a token by splicing another wallet's base64 segment into a
    // genuine token's shape — this must fail even though the format is
    // well-formed, because the signature no longer matches the payload.
    const real = createUserSessionToken(WALLET);
    const parts = real.split(".");
    const forgedWalletB64 = Buffer.from("0xattacker000000000000000000000000000000").toString("base64url");
    const forged = [parts[0], forgedWalletB64, parts[2], parts[3]].join(".");
    expect(verifyUserSessionToken(forged).valid).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyUserSessionToken("").valid).toBe(false);
    expect(verifyUserSessionToken("not-a-token").valid).toBe(false);
    expect(verifyUserSessionToken("user.onlytwo.parts").valid).toBe(false);
    expect(verifyUserSessionToken(null).valid).toBe(false);
    expect(verifyUserSessionToken(undefined).valid).toBe(false);
  });

  it("rejects a token whose issuedAt is in the future or unparseable", () => {
    const [, walletB64] = createUserSessionToken(WALLET).split(".");
    const bogus = `user.${walletB64}.not-a-number.somesignature`;
    expect(verifyUserSessionToken(bogus).valid).toBe(false);
  });

  it("rejects an expired token (older than the 30-day session window)", () => {
    // Forge an issuedAt far enough in the past that it must be expired,
    // re-signed with the same test secret so only the age check can fail.
    const walletB64 = Buffer.from(WALLET.toLowerCase()).toString("base64url");
    const longAgo = Date.now() - 1000 * 60 * 60 * 24 * 31; // 31 days
    const payload = `user.${walletB64}.${longAgo}`;
    const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(payload).digest("base64url");
    const expiredToken = `${payload}.${signature}`;
    expect(verifyUserSessionToken(expiredToken).valid).toBe(false);
  });

  it("throws when asked to sign an empty wallet address rather than issuing a bogus session", () => {
    expect(() => createUserSessionToken("")).toThrow();
    expect(() => createUserSessionToken(null)).toThrow();
  });
});
