import { serializeCookie } from "./_lib/cookies.js";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  isConfiguredAdminEnv,
  verifyAdminCredentials,
} from "./_lib/adminAuth.js";

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

  if (!isConfiguredAdminEnv()) {
    sendJson(res, 503, {
      ok: false,
      error: "Admin sign-in is not configured on this deployment yet.",
    });
    return;
  }

  try {
    const { phone, password } = await readJsonBody(req);

    if (!verifyAdminCredentials({ phone, password })) {
      sendJson(res, 401, { ok: false, error: "Invalid admin phone number or password." });
      return;
    }

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
