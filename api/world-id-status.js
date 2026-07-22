import { allowMethods, sendJson } from "./_lib/http.js";
import { parseCookies } from "./_lib/cookies.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";
import {
  HIGH_VALUE_KES_THRESHOLD,
  isWalletVerified,
  worldIdVerificationAvailable,
} from "./_lib/worldId.js";

/**
 * Lets the client know, up front, whether the signed-in wallet already
 * completed World ID verification (so a returning user never re-does it)
 * and whether the feature is even switched on in this environment. The
 * client uses this only to decide whether to show the widget before a
 * high-value order — the actual gate is server-side in api/orders.js, so a
 * spoofed "verified: true" here buys nothing.
 */
export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  const available = worldIdVerificationAvailable();

  if (!available) {
    sendJson(res, 200, { ok: true, available: false, verified: false, threshold: HIGH_VALUE_KES_THRESHOLD });
    return;
  }

  const cookies = parseCookies(req);
  const session = verifyUserSessionToken(cookies[USER_SESSION_COOKIE]);

  if (!session.valid) {
    sendJson(res, 401, { ok: false, available: true, verified: false, error: "Sign in first." });
    return;
  }

  let verified = false;
  try {
    verified = await isWalletVerified(session.walletAddress);
  } catch {
    // Fail closed: if we can't confirm, treat as unverified so the client
    // prompts for World ID rather than silently skipping the check.
    verified = false;
  }

  sendJson(res, 200, {
    ok: true,
    available: true,
    verified,
    threshold: HIGH_VALUE_KES_THRESHOLD,
  });
}
