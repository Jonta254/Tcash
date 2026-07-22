import { allowMethods, sendJson } from "./_lib/http.js";
import { parseCookies } from "./_lib/cookies.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";
import { signHighValueRequest, worldIdSigningConfigured } from "./_lib/worldId.js";

/**
 * Mints a fresh, RP-signed context the client hands to IDKit so World App
 * can trust the proof request genuinely came from Tcash. The signing key
 * never leaves the server. Requires a real SIWE session — an anonymous
 * caller can't obtain a signed request — and a trusted origin, since this
 * is a state-shaped action (each call mints a new short-lived nonce).
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

  if (!isTrustedOrigin(req)) {
    sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
    return;
  }

  if (!worldIdSigningConfigured()) {
    sendJson(res, 503, {
      ok: false,
      error: "World ID verification is not configured yet.",
    });
    return;
  }

  try {
    const rp_context = signHighValueRequest();
    sendJson(res, 200, { ok: true, rp_context });
  } catch {
    sendJson(res, 502, { ok: false, error: "Could not start World ID verification." });
  }
}
