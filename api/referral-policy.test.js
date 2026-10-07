import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./_lib/adminAuth.js", () => ({ requestIsRecognizedAdmin: () => false, getRequestAdminWallet: () => null }));
vi.mock("./_lib/userSession.js", () => ({ USER_SESSION_COOKIE: "session", verifyUserSessionToken: () => ({ valid: true, walletAddress: "0xabc" }) }));
vi.mock("./_lib/cookies.js", () => ({ parseCookies: () => ({ session: "signed" }) }));
describe("unavailable referral rewards", () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.com"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("rejects signed-in users' self-reported rewards before reading or writing a store", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { default: handler } = await import("./referral-claims.js");
    const res = { setHeader: vi.fn(), end: vi.fn() };
    await handler({ method: "POST", headers: {}, body: { claim: { rewardKes: 1000000, status: "paid" } } }, res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.end.mock.calls[0][0])).toEqual(expect.objectContaining({ ok: false }));
    expect(fetch).not.toHaveBeenCalled();
  });
});
