import { signRequest } from "@worldcoin/idkit-core/signing";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { getWorldPortalConfig, hasWorldIdConfig } from "./_lib/world.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    if (!hasWorldIdConfig()) {
      sendJson(res, 500, {
        success: false,
        code: "world_id_not_configured",
        error: "TMpesa World ID verification is not ready yet. Please try again shortly.",
      });
      return;
    }

    const { action } = await readJsonBody(req);

    if (!action || typeof action !== "string") {
      sendJson(res, 400, {
        success: false,
        error: "A World ID action is required.",
      });
      return;
    }

    const { appId, rpId, rpSigningKey } = getWorldPortalConfig();
    const signature = signRequest({
      action,
      signingKeyHex: rpSigningKey,
    });

    sendJson(res, 200, {
      success: true,
      app_id: appId,
      rp_context: {
        rp_id: rpId,
        nonce: signature.nonce,
        created_at: signature.createdAt,
        expires_at: signature.expiresAt,
        signature: signature.sig,
      },
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unable to prepare World ID verification.",
    });
  }
}
