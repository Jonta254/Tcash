import { verifyCloudProof } from "@worldcoin/minikit-js";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { getWorldPortalConfig } from "./_lib/world.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const { payload, action, signal } = await readJsonBody(req);
    const { appId, rpId } = getWorldPortalConfig();

    if (payload?.status === "success" && action) {
      const verifyRes = await verifyCloudProof(payload, appId, action, signal);

      if (!verifyRes?.success) {
        sendJson(res, 400, {
          success: false,
          error: verifyRes?.detail || verifyRes?.code || "Verification was not accepted.",
          verifyRes,
        });
        return;
      }

      sendJson(res, 200, {
        success: true,
        verifyRes,
      });
      return;
    }

    if (!payload || !rpId) {
      sendJson(res, 400, {
        success: false,
        error: "Missing verification payload or World RP identifier.",
      });
      return;
    }

    const response = await fetch(`https://developer.worldcoin.org/api/v4/verify/${rpId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const verifyRes = await response.json().catch(() => ({}));

    if (!response.ok || !verifyRes?.success) {
      sendJson(res, 400, {
        success: false,
        error: verifyRes?.detail || verifyRes?.code || verifyRes?.error || "Verification was not accepted.",
        verifyRes,
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      verifyRes,
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unable to verify proof.",
    });
  }
}
