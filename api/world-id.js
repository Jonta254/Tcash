import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { parseCookies } from "./_lib/cookies.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { logEvent, logSecurityEvent } from "./_lib/log.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";
import {
  HIGH_VALUE_KES_THRESHOLD,
  claimNullifierForWallet,
  extractNullifier,
  isPlausibleHighValueProof,
  isWalletVerified,
  markWalletVerified,
  signHighValueRequest,
  verifyProofWithWorld,
  worldIdSigningConfigured,
  worldIdVerificationAvailable,
} from "./_lib/worldId.js";

// All three World ID operations live in one function on purpose: Vercel's
// zero-config api/ routing makes every top-level .js file its own serverless
// function, and this project sits exactly at the Hobby plan's 12-function
// per-deployment ceiling (see .vercelignore, which exists for the same
// reason). Split into world-id-sign/verify/status it deployed as three
// functions and the deploy failed outright with
// exceeded_serverless_functions_per_deployment. Dispatched on an explicit
// `action` rather than payload shape, since sign/verify/status are genuinely
// different operations rather than variants of one.
//
//   GET  /api/world-id                        -> status
//   POST /api/world-id {action:"sign"}        -> RP-signed context for IDKit
//   POST /api/world-id {action:"verify", result} -> verify + record proof

function readSession(req) {
  const cookies = parseCookies(req);
  return verifyUserSessionToken(cookies[USER_SESSION_COOKIE]);
}

/**
 * Whether the feature is on and whether this wallet already verified, so a
 * returning user is never asked twice. Advisory only — the real gate is in
 * api/orders.js, so a spoofed "verified" here buys nothing.
 */
async function handleStatus(req, res) {
  if (!worldIdVerificationAvailable()) {
    sendJson(res, 200, {
      ok: true,
      available: false,
      verified: false,
      threshold: HIGH_VALUE_KES_THRESHOLD,
    });
    return;
  }

  const session = readSession(req);

  if (!session.valid) {
    sendJson(res, 401, { ok: false, available: true, verified: false, error: "Sign in first." });
    return;
  }

  let verified = false;
  try {
    verified = await isWalletVerified(session.walletAddress);
  } catch {
    // Fail closed: if we can't confirm, prompt for World ID rather than
    // silently skipping the check.
    verified = false;
  }

  sendJson(res, 200, {
    ok: true,
    available: true,
    verified,
    threshold: HIGH_VALUE_KES_THRESHOLD,
  });
}

/**
 * Mints a fresh, short-lived RP-signed context for IDKit. The signing key
 * never leaves the server.
 */
function handleSign(res) {
  if (!worldIdSigningConfigured()) {
    sendJson(res, 503, { ok: false, error: "World ID verification is not configured yet." });
    return;
  }

  try {
    sendJson(res, 200, { ok: true, rp_context: signHighValueRequest() });
  } catch {
    sendJson(res, 502, { ok: false, error: "Could not start World ID verification." });
  }
}

/**
 * Has World verify the proof, then permanently binds the RP-scoped nullifier
 * to the SIWE-authenticated wallet and marks that wallet verified. The wallet
 * comes from the signed session cookie, never the request body, so a proof can
 * only ever verify the wallet that actually presented it.
 */
async function handleVerify(res, wallet, result) {
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

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST"])) {
    return;
  }

  if (req.method === "GET") {
    await handleStatus(req, res);
    return;
  }

  const session = readSession(req);

  if (!session.valid) {
    sendJson(res, 401, { ok: false, error: "Sign in to verify with World ID." });
    return;
  }

  if (!isTrustedOrigin(req)) {
    logSecurityEvent("worldid.blocked_origin", {});
    sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid request body." });
    return;
  }

  if (payload?.action === "sign") {
    handleSign(res);
    return;
  }

  if (payload?.action === "verify") {
    if (!worldIdVerificationAvailable()) {
      sendJson(res, 503, { ok: false, error: "World ID verification is not configured yet." });
      return;
    }

    await handleVerify(res, session.walletAddress, payload?.result);
    return;
  }

  sendJson(res, 400, { ok: false, error: "Unknown World ID action." });
}
