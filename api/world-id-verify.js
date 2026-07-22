import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { parseCookies } from "./_lib/cookies.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { logEvent, logSecurityEvent } from "./_lib/log.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";
import {
  claimNullifierForWallet,
  extractNullifier,
  isPlausibleHighValueProof,
  markWalletVerified,
  verifyProofWithWorld,
  worldIdVerificationAvailable,
} from "./_lib/worldId.js";

/**
 * Accepts an IDKit v4 proof from the client, has World verify it, and — on
 * success — permanently binds the person's RP-scoped nullifier to the
 * SIWE-authenticated wallet and marks that wallet World ID verified. From
 * then on the wallet may place high-value orders (api/orders.js checks the
 * same verified record).
 *
 * The wallet is taken from the signed session cookie, never from the
 * request body, so a proof can only ever verify the wallet that actually
 * presented it.
 */
export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  const cookies = parseCookies(req);
  const session = verifyUserSessionToken(cookies[USER_SESSION_COOKIE]);

  if (!session.valid) {
    sendJson(res, 401, { ok: false, error: "Sign in to verify with World ID." });
    return;
  }

  const wallet = session.walletAddress;

  if (!isTrustedOrigin(req)) {
    logSecurityEvent("worldid.verify.blocked_origin", {});
    sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
    return;
  }

  if (!worldIdVerificationAvailable()) {
    sendJson(res, 503, { ok: false, error: "World ID verification is not configured yet." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid request body." });
    return;
  }

  const result = payload?.result || payload;

  if (!isPlausibleHighValueProof(result)) {
    sendJson(res, 400, { ok: false, error: "This does not look like a valid World ID proof." });
    return;
  }

  let worldResponse;
  try {
    worldResponse = await verifyProofWithWorld(result);
  } catch {
    sendJson(res, 502, { ok: false, error: "Could not reach the World ID verifier. Try again." });
    return;
  }

  if (!worldResponse.ok) {
    logSecurityEvent("worldid.verify.rejected", { wallet, status: worldResponse.status });
    sendJson(res, 400, { ok: false, error: "World ID verification failed." });
    return;
  }

  const nullifier = extractNullifier(result);

  if (!nullifier) {
    sendJson(res, 400, { ok: false, error: "World ID proof is missing its nullifier." });
    return;
  }

  let claim;
  try {
    claim = await claimNullifierForWallet(nullifier, wallet);
  } catch {
    sendJson(res, 502, { ok: false, error: "Could not record your verification. Try again." });
    return;
  }

  if (!claim.ok) {
    logSecurityEvent("worldid.verify.nullifier_conflict", { wallet });
    sendJson(res, 409, {
      ok: false,
      error: "This World ID has already verified a different Tcash wallet.",
    });
    return;
  }

  try {
    await markWalletVerified(wallet, nullifier);
  } catch {
    sendJson(res, 502, { ok: false, error: "Could not save your verification. Try again." });
    return;
  }

  logEvent("worldid.verify.success", { wallet, idempotent: Boolean(claim.idempotent) });
  sendJson(res, 200, { ok: true, verified: true });
}
