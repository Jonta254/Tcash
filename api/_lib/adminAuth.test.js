import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-do-not-use-in-prod";
  process.env.ADMIN_PHONE = "0700000000";
  process.env.ADMIN_PASSWORD = "test-password";
});

const { createAdminSessionToken, ADMIN_SESSION_COOKIE, requestIsRecognizedAdmin, isConfiguredAdminEnv, verifyAdminCredentials } =
  await import("./adminAuth.js");
const { createUserSessionToken, USER_SESSION_COOKIE } = await import("./userSession.js");

const ADMIN_WALLET = "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc";
const OTHER_WALLET = "0x1111111111111111111111111111111111aaaa";

function reqWithCookies(cookies) {
  const header = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
  return { headers: { cookie: header } };
}

describe("requestIsRecognizedAdmin — the two legitimate admin paths", () => {
  it("recognizes the phone/password admin-login session", () => {
    const token = createAdminSessionToken();
    const req = reqWithCookies({ [ADMIN_SESSION_COOKIE]: token });
    expect(requestIsRecognizedAdmin(req)).toBe(true);
  });

  it("recognizes a World App login as the configured operator wallet", () => {
    // This is the real production path — logging into World App as the
    // configured admin identity — and the one that was silently broken
    // before this fix: the server-side gate only ever checked the
    // phone/password cookie, which this path never sets.
    const token = createUserSessionToken(ADMIN_WALLET);
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

  it("does not recognize a forged/expired token from either path", () => {
    expect(requestIsRecognizedAdmin(reqWithCookies({ [ADMIN_SESSION_COOKIE]: "garbage" }))).toBe(false);
    expect(requestIsRecognizedAdmin(reqWithCookies({ [USER_SESSION_COOKIE]: "garbage" }))).toBe(false);
  });
});

describe("verifyAdminCredentials", () => {
  it("accepts the exact configured phone/password", () => {
    expect(verifyAdminCredentials({ phone: "0700000000", password: "test-password" })).toBe(true);
  });

  it("rejects a wrong password even with the right phone", () => {
    expect(verifyAdminCredentials({ phone: "0700000000", password: "wrong" })).toBe(false);
  });

  it("rejects when the env isn't configured", () => {
    const savedPassword = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    expect(isConfiguredAdminEnv()).toBe(false);
    expect(verifyAdminCredentials({ phone: "0700000000", password: "test-password" })).toBe(false);
    process.env.ADMIN_PASSWORD = savedPassword;
  });
});
