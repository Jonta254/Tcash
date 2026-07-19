import { afterEach, beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-do-not-use-in-prod";
  delete process.env.ADMIN_WALLET_ADDRESSES;
});

afterEach(() => {
  delete process.env.ADMIN_WALLET_ADDRESSES;
});

const { getAdminWalletAllowlist, getRequestAdminWallet, requestIsRecognizedAdmin } =
  await import("./adminAuth.js");
const { createUserSessionToken, USER_SESSION_COOKIE } = await import("./userSession.js");

const DEFAULT_ADMIN_WALLET = "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc";
const OTHER_WALLET = "0x1111111111111111111111111111111111aaaa";
const SECOND_ADMIN_WALLET = "0x2222222222222222222222222222222222bbbb";

function reqWithCookies(cookies) {
  const header = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
  return { headers: { cookie: header } };
}

describe("requestIsRecognizedAdmin — the only path: a SIWE session wallet in the server allowlist", () => {
  it("recognizes a World App login as the default configured operator wallet", () => {
    // The real production path — logging into World App as the
    // configured admin identity. There is no separate credential path;
    // this is the entire admin authentication architecture.
    const token = createUserSessionToken(DEFAULT_ADMIN_WALLET);
    const req = reqWithCookies({ [USER_SESSION_COOKIE]: token });
    expect(requestIsRecognizedAdmin(req)).toBe(true);
  });

  it("does not recognize a regular user's wallet as admin", () => {
    const token = createUserSessionToken(OTHER_WALLET);
    const req = reqWithCookies({ [USER_SESSION_COOKIE]: token });
    expect(requestIsRecognizedAdmin(req)).toBe(false);
  });

  it("does not recognize a request with no cookies at all", () => {
    expect(requestIsRecognizedAdmin({ headers: {} })).toBe(false);
  });

  it("does not recognize a forged/garbage session token", () => {
    expect(requestIsRecognizedAdmin(reqWithCookies({ [USER_SESSION_COOKIE]: "garbage" }))).toBe(false);
  });

  it("is case-insensitive on the wallet address", () => {
    const token = createUserSessionToken(DEFAULT_ADMIN_WALLET.toUpperCase());
    const req = reqWithCookies({ [USER_SESSION_COOKIE]: token });
    expect(requestIsRecognizedAdmin(req)).toBe(true);
  });
});

describe("getAdminWalletAllowlist — server-configured, not hardcoded", () => {
  it("falls back to the single default wallet when unconfigured", () => {
    expect(getAdminWalletAllowlist()).toEqual(new Set([DEFAULT_ADMIN_WALLET.toLowerCase()]));
  });

  it("supports multiple wallets via a comma-separated env var", () => {
    process.env.ADMIN_WALLET_ADDRESSES = `${SECOND_ADMIN_WALLET}, ${OTHER_WALLET}`;
    expect(getAdminWalletAllowlist()).toEqual(
      new Set([SECOND_ADMIN_WALLET.toLowerCase(), OTHER_WALLET.toLowerCase()]),
    );
  });

  it("revokes the default wallet once ADMIN_WALLET_ADDRESSES is set without it — this is how access is revoked", () => {
    process.env.ADMIN_WALLET_ADDRESSES = SECOND_ADMIN_WALLET;
    const token = createUserSessionToken(DEFAULT_ADMIN_WALLET);
    const req = reqWithCookies({ [USER_SESSION_COOKIE]: token });
    expect(requestIsRecognizedAdmin(req)).toBe(false);

    const secondAdminToken = createUserSessionToken(SECOND_ADMIN_WALLET);
    const secondAdminReq = reqWithCookies({ [USER_SESSION_COOKIE]: secondAdminToken });
    expect(requestIsRecognizedAdmin(secondAdminReq)).toBe(true);
  });
});

describe("getRequestAdminWallet — attribution for audit logs", () => {
  it("returns the caller's own (lowercased) wallet when recognized as admin", () => {
    const token = createUserSessionToken(DEFAULT_ADMIN_WALLET.toUpperCase());
    const req = reqWithCookies({ [USER_SESSION_COOKIE]: token });
    expect(getRequestAdminWallet(req)).toBe(DEFAULT_ADMIN_WALLET.toLowerCase());
  });

  it("returns null for a non-admin session", () => {
    const token = createUserSessionToken(OTHER_WALLET);
    const req = reqWithCookies({ [USER_SESSION_COOKIE]: token });
    expect(getRequestAdminWallet(req)).toBeNull();
  });

  it("returns null with no session at all", () => {
    expect(getRequestAdminWallet({ headers: {} })).toBeNull();
  });
});
