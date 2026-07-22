import { allowMethods, sendJson } from "./_lib/http.js";
import { hasWorldPortalConfig } from "./_lib/world.js";
import { worldIdConfigDiagnostics } from "./_lib/worldId.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  sendJson(res, 200, {
    ok: true,
    worldPortalConfigured: hasWorldPortalConfig(),
    orderNotificationsConfigured: Boolean(process.env.RESEND_API_KEY),
    // Booleans only. The World ID gate stays off unless BOTH a signing key
    // and a record store are present, so reporting them separately turns an
    // opaque "available: false" into an actionable answer.
    worldId: worldIdConfigDiagnostics(),
  });
}
