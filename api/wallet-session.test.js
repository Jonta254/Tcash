import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./complete-siwe.js";
import { createUserSessionToken, USER_SESSION_COOKIE } from "./_lib/userSession.js";
describe("wallet session reconnect", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("rejects missing and tampered cookies without any wallet RPC", async () => {
    for (const cookie of ["", `${USER_SESSION_COOKIE}=tampered`]) {
      const res = { setHeader: vi.fn(), end: vi.fn() };
      await handler({ method: "GET", headers: { cookie } }, res);
      expect(res.statusCode).toBe(401); expect(JSON.parse(res.end.mock.calls[0][0]).valid).toBe(false);
    }
  });
  it("returns the wallet from the signed server session and prohibits caching", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-only-wallet-session-secret");
    const wallet = "0x" + "1".repeat(40);
    const token = createUserSessionToken(wallet);
    const res = { setHeader: vi.fn(), end: vi.fn() };
    await handler({ method: "GET", headers: { cookie: `${USER_SESSION_COOKIE}=${token}` } }, res);
    expect(res.statusCode).toBe(200); expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ valid: true, walletAddress: wallet });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
  });
});
