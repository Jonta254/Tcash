import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";

const FALLBACK_APP_ID = "app_02bd6decc052cfd1dfa2948744af6c6f";
const WORLD_NOTIFICATIONS_URL = "https://developer.world.org/api/v2/minikit/send-notification";

function buildNotificationPayload({ walletAddress, title, message, miniAppPath = "/orders" }) {
  return {
    app_id: process.env.APP_ID || process.env.VITE_WORLD_APP_ID || FALLBACK_APP_ID,
    wallet_addresses: [walletAddress],
    title,
    message,
    mini_app_path: miniAppPath,
  };
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const apiKey =
      process.env.WORLD_NOTIFICATION_API_KEY ||
      process.env.DEV_PORTAL_API_KEY ||
      process.env.WORLD_API_KEY;

    if (!apiKey) {
      sendJson(res, 200, {
        sent: false,
        skipped: true,
        reason: "WORLD notification API key is not configured.",
      });
      return;
    }

    const { walletAddress, title, message, miniAppPath } = await readJsonBody(req);

    if (!walletAddress || !title || !message) {
      sendJson(res, 400, {
        sent: false,
        error: "walletAddress, title, and message are required.",
      });
      return;
    }

    const response = await fetch(WORLD_NOTIFICATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildNotificationPayload({
          walletAddress,
          title,
          message,
          miniAppPath,
        }),
      ),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      sendJson(res, response.status, {
        sent: false,
        error: payload?.message || payload?.error || "Unable to send World notification.",
      });
      return;
    }

    sendJson(res, 200, {
      sent: true,
      result: payload,
    });
  } catch (error) {
    sendJson(res, 500, {
      sent: false,
      error: error instanceof Error ? error.message : "Unable to send World notification.",
    });
  }
}
