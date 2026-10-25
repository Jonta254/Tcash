import { afterEach, expect, it, vi } from "vitest";
import { MiniKit } from "@worldcoin/minikit-js";

afterEach(() => vi.unstubAllGlobals());

it("the real SDK delivers wallet approval even when username fetch never finishes", async () => {
  const profileFetch = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", profileFetch);
  const commands = ["attestation", "pay", "wallet-auth", "send-transaction", "sign-message", "sign-typed-data", "share-contacts", "request-permission", "get-permissions", "send-haptic-feedback", "share", "chat", "close-miniapp"];
  vi.stubGlobal("window", {
    location: { href: "https://tcash.test/login" },
    WorldApp: { world_app_version: 3000000, supported_commands: commands.map(name => ({ name, supported_versions: [1, 2] })) },
    webkit: { messageHandlers: { minikit: { postMessage: vi.fn() } } },
  });
  expect(MiniKit.install("app_test").success).toBe(true);
  const result = MiniKit.walletAuth({ nonce: "validNonce123", statement: "Sign in to Tcash" });
  const payload = { status: "success", version: 2, address: "0x" + "1".repeat(40), message: "signed message", signature: "0xsignature" };
  MiniKit.trigger("miniapp-wallet-auth", payload);
  await expect(result).resolves.toMatchObject({ executedWith: "minikit", data: { address: payload.address, signature: payload.signature } });
  expect(profileFetch).not.toHaveBeenCalled();
});
