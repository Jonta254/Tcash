import { serializeCookie } from "./_lib/cookies.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { logSecurityEvent } from "./_lib/log.js";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  isConfiguredAdminEnv,
  verifyAdminCredentials,
} from "./_lib/adminAuth.js";

const LOGIN_RATE_LIMIT = { limit: 8, windowSeconds: 10 * 60 };

/**
 * Admin credentials are never compared in the client. The phone/password
 * the operator types goes over the wire once, gets checked here against
 * ADMIN_PHONE / ADMIN_PASSWORD (Vercel env vars, never committed), and
 * the response is a short-lived signed session cookie — not the
 * credential itself, and not a client-visible truth value the bundle
 * could be inspected to bypass.
 */
export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  const clientIp = getClientIp(req);

  if (!isTrustedOrigin(req)) {
    logSecurityEvent("admin_login.blocked_origin", { ip: clientIp });
    sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
    return;
  }

  if (!isConfiguredAdminEnv()) {
    sendJson(res, 503, {
      ok: false,
      error: "Admin sign-in is not configured on this deployment yet.",
    });
    return;
  }

  const rateLimit = await checkRateLimit(`admin-login:${clientIp}`, LOGIN_RATE_LIMIT);

  if (!rateLimit.allowed) {
    logSecurityEvent("admin_login.rate_limited", { ip: clientIp });
    sendJson(res, 429, {
      ok: false,
      error: "Too many sign-in attempts. Try again in a few minutes.",
    });
    return;
  }

  try {
    const { phone, password } = await readJsonBody(req);

    if (!verifyAdminCredentials({ phone, password })) {
      logSecurityEvent("admin_login.failed", { ip: clientIp });
      sendJson(res, 401, { ok: false, error: "Invalid admin phone number or password." });
      return;
    }

    logSecurityEvent("admin_login.success", { ip: clientIp });
    const token = createAdminSessionToken();

    res.setHeader(
      "Set-Cookie",
      serializeCookie(ADMIN_SESSION_COOKIE, token, {
        maxAge: ADMIN_SESSION_MAX_AGE,
        sameSite: "None",
        secure: true,
      }),
    );

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to sign in.",
    });
  }
}
