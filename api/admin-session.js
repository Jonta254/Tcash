import { allowMethods, sendJson } from "./_lib/http.js";
import { requestIsRecognizedAdmin } from "./_lib/adminAuth.js";

/**
 * The one source of truth the client is allowed to use for "am I an
 * administrator" — a live server check against the SIWE-verified
 * session wallet (see api/_lib/adminAuth.js), never a value the client
 * computed itself and persisted to localStorage. This endpoint is
 * read-only and side-effect-free: it doesn't grant admin access, it
 * only reports what the server already knows from the existing session
 * cookie. The Profile screen and the Admin Console both call this
 * before showing anything admin-related; every actual privileged write
 * is still independently checked server-side in api/orders.js, so this
 * endpoint being unavailable or slow degrades to "hide the admin UI,"
 * never to "grant access."
 */
export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  sendJson(res, 200, { isAdmin: requestIsRecognizedAdmin(req) });
}
