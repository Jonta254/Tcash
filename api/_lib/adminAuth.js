import { parseCookies } from "./cookies.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./userSession.js";

// The operator's public, on-chain wallet address — not a secret, and
// already visible in api/orders.js's World-notification target. Kept
// here as the zero-config default so the real admin path keeps working
// without requiring an environment variable to be set. Once
// ADMIN_WALLET_ADDRESSES is set in production, it fully replaces this
// default (not merged with it) — that's what makes revocation possible:
// removing a wallet from the env var actually removes its access,
// rather than a hardcoded fallback silently keeping it recognized.
const DEFAULT_ADMIN_WALLET = "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc";

/**
 * The server-held source of truth for "which wallets are administrators."
 * Comma-separated in ADMIN_WALLET_ADDRESSES so production can add,
 * remove, or rotate operators without a code change or redeploy of
 * application logic — only an environment variable update (which still
 * requires the platform to pick up the new value; see the certification
 * report for what "immediately" actually means on Vercel).
 */
export function getAdminWalletAllowlist() {
  const configured = String(process.env.ADMIN_WALLET_ADDRESSES || "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    return new Set(configured);
  }

  return new Set([DEFAULT_ADMIN_WALLET.toLowerCase()]);
}

/**
 * The complete admin authorization decision, and the only one this
 * application makes. There is no username, no password, no separate
 * admin login endpoint, and no client-supplied flag involved anywhere
 * in this function:
 *
 *   World App → wallet connect → World ID → SIWE (api/complete-siwe.js)
 *   → signed session cookie (api/_lib/userSession.js) → this function
 *   reads that cookie's server-verified wallet address and checks it
 *   against the server-held allowlist above.
 *
 * A request is an administrator if and only if it carries a valid,
 * unexpired SIWE session whose wallet address is in the allowlist.
 * Nothing about "admin-ness" is ever asserted by the client — this is
 * the single choke point every privileged endpoint must call.
 */
export function requestIsRecognizedAdmin(req) {
  return getRequestAdminWallet(req) !== null;
}

/**
 * The admin's own wallet address, for attribution in audit logs — or
 * null if the request isn't a recognized admin. Reads the exact same
 * verified session as requestIsRecognizedAdmin so the two can never
 * disagree about who's calling.
 */
export function getRequestAdminWallet(req) {
  const cookies = parseCookies(req);
  const session = verifyUserSessionToken(cookies[USER_SESSION_COOKIE]);

  if (!session.valid || !session.walletAddress) {
    return null;
  }

  const wallet = session.walletAddress.toLowerCase();
  return getAdminWalletAllowlist().has(wallet) ? wallet : null;
}
