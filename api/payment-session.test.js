import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./_lib/userSession.js", () => ({ USER_SESSION_COOKIE: "session", verifyUserSessionToken: () => ({ valid: false }) }));
import confirmPayment from "./confirm-payment.js";
import paymentReference from "./payment-reference.js";
describe("payment session boundary", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([["confirmation", confirmPayment], ["payment preparation", paymentReference]])("rejects unsigned %s without contacting a payment provider", async (_name, handler) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const res = { setHeader: vi.fn(), end: vi.fn() };
    await handler({ method: "POST", headers: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});
