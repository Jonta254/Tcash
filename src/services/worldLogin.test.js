import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), verify: vi.fn(), session: vi.fn(), profile: vi.fn() }));
vi.mock("@worldcoin/minikit-js", () => ({ MiniKit: { isInstalled: () => true, user: {}, commandsAsync: { walletAuth: m.auth }, getUserByAddress: m.profile } }));
vi.mock("./backendService", () => ({ requestServerNonce: async () => ({ nonce: "freshNonce123", nonceSignature: "signed" }), completeSiweVerification: m.verify, checkWalletSession: m.session }));
import { connectWithWorldAppWallet } from "./worldAppService";
describe("wallet login recovery", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); m.auth.mockResolvedValue({ finalPayload: { status: "success", address: "0xabc", signature: "signed" } }); m.verify.mockResolvedValue({ isValid: true, address: "0xabc" }); m.session.mockResolvedValue({ valid: true, walletAddress: "0xabc" }); m.profile.mockResolvedValue({ username: "amina" }); });
  afterEach(() => vi.useRealTimers());
  it("completes only after verifying the persisted server session", async () => { const result = await connectWithWorldAppWallet(); expect(result.username).toBe("amina"); expect(m.session).toHaveBeenCalledOnce(); });
  it("does not treat a blocked or missing session cookie as a successful login", async () => { m.session.mockResolvedValue({ valid: false }); await expect(connectWithWorldAppWallet()).rejects.toThrow("session could not be saved"); });
  it("rejects a different wallet's server session", async () => { m.session.mockResolvedValue({ valid: true, walletAddress: "0xother" }); await expect(connectWithWorldAppWallet()).rejects.toThrow("session could not be saved"); });
  it("ends a stalled native sign-in instead of spinning forever", async () => { m.auth.mockReturnValue(new Promise(() => {})); const assertion = expect(connectWithWorldAppWallet()).rejects.toThrow("did not finish sign-in"); await vi.advanceTimersByTimeAsync(90001); await assertion; expect(m.verify).not.toHaveBeenCalled(); });
  it("does not let an optional profile lookup block authenticated access", async () => { m.profile.mockReturnValue(new Promise(() => {})); const result = connectWithWorldAppWallet(); await vi.advanceTimersByTimeAsync(5001); expect((await result).walletAddress).toBe("0xabc"); });
  it("shows cancellation and never verifies a rejected native request", async () => { m.auth.mockResolvedValue({ finalPayload: { status: "error", message: "User cancelled", error_code: "user_rejected" } }); await expect(connectWithWorldAppWallet()).rejects.toThrow("User cancelled"); expect(m.verify).not.toHaveBeenCalled(); });
});
