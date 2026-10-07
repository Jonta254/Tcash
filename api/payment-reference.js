import { serializeCookie } from "./_lib/cookies.js";
import { allowMethods, sendJson } from "./_lib/http.js";
import { hasWorldPortalConfig } from "./_lib/world.js";
import { parseCookies } from "./_lib/cookies.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";
import { createServerNonce } from "./_lib/world.js";
import { isTrustedOrigin } from "./_lib/csrf.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  const session = verifyUserSessionToken(parseCookies(req)[USER_SESSION_COOKIE]);
  if (!session.valid) { sendJson(res, 401, { error: "Sign in again before paying." }); return; }
  if (!isTrustedOrigin(req)) { sendJson(res, 403, { error: "Request origin could not be verified." }); return; }
  const storeReady = Boolean((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN));
  if (!hasWorldPortalConfig() || !storeReady) { sendJson(res, 503, { error: "The payment desk is unavailable. Contact support before sending funds." }); return; }
  const reference = `tmpesa_${createServerNonce(18)}`;
  res.setHeader(
    "Set-Cookie",
    serializeCookie("tmpesa_payment_reference", reference, {
      maxAge: 60 * 10,
      sameSite: "None",
      secure: true,
    }),
  );

  sendJson(res, 200, { reference });
}
