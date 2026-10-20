import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
const context = vi.hoisted(() => ({ admin: true }));
vi.mock("./_lib/adminAuth.js", () => ({ requestIsRecognizedAdmin: () => context.admin, getRequestAdminWallet: () => "operator-wallet" }));
vi.mock("./_lib/userSession.js", () => ({ USER_SESSION_COOKIE: "session", verifyUserSessionToken: () => ({ valid: true, walletAddress: "customer-wallet" }) }));
vi.mock("./_lib/csrf.js", () => ({ isTrustedOrigin: () => true }));
const base = { id: "integration-order", type: "sell", asset: "WLD", cryptoAmount: 3, kesAmount: 200, payoutPhoneNumber: "0712345678", userWalletAddress: "customer-wallet", status: "paid", paymentReference: "0x" + "a".repeat(64) };

describe("operator API persistence boundary (mock Redis transport)", () => {
  let handler, records, writes, failWrite;
  beforeEach(async () => {
    vi.resetModules();
    context.admin = true; records = [base]; writes = []; failWrite = false;
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture-token");
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const command = JSON.parse(init.body);
      if (command[0] === "HVALS") return { ok: true, json: async () => ({ result: records.map(order => JSON.stringify({ order })) }) };
      if (command[0] === "EVAL") {
        writes.push(command);
        if (failWrite) return { ok: false, json: async () => ({ error: "Store unavailable" }) };
        records = JSON.parse(command[4]);
        return { ok: true, json: async () => ({ result: records.length }) };
      }
      throw new Error("Unexpected Redis command: " + command[0]);
    }));
    handler = (await import("./orders.js")).default;
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  async function request(order, method = "POST") {
    const res = { setHeader: vi.fn(), end: vi.fn() };
    const req = Readable.from([Buffer.from(JSON.stringify({ orders: [order], notifyAdmin: false }))]);
    req.method = method; req.headers = {};
    await handler(req, res);
    return { status: res.statusCode, body: JSON.parse(res.end.mock.calls[0][0]) };
  }
  it("saves completion evidence with server-attributed reviewer and reads it back", async () => {
    const result = await request({ ...base, status: "completed", settlementReference: "DEF1234567", reviewedBy: "spoofed" });
    expect(result.status).toBe(200);
    expect(result.body.orders[0]).toMatchObject({ status: "completed", settlementReference: "DEF1234567", reviewedBy: "operator-wallet", reviewFromStatus: "paid" });
    expect(result.body.orders[0].reviewedAt).toBeTruthy();
    const read = await request(null, "GET");
    expect(read.body.orders[0].settlementReference).toBe("DEF1234567");
  });
  it("persists a rejection reason", async () => {
    const result = await request({ ...base, status: "rejected", rejectionReason: "Amount does not match." });
    expect(result.status).toBe(200);
    expect(records[0].rejectionReason).toBe("Amount does not match.");
  });
  it("rejects invalid completion evidence without writing", async () => {
    expect((await request({ ...base, status: "completed", settlementReference: "bad" })).status).toBe(409);
    expect(writes).toHaveLength(0);
  });
  it("does not let a customer complete an order", async () => {
    context.admin = false;
    expect((await request({ ...base, status: "completed", settlementReference: "DEF1234567" })).status).toBe(403);
    expect(writes).toHaveLength(0);
  });
  it("reports a failed write without claiming settlement", async () => {
    failWrite = true;
    const result = await request({ ...base, status: "completed", settlementReference: "DEF1234567" });
    expect(result.status).toBe(502);
    expect(records[0].status).toBe("paid");
  });
});
