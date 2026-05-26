import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";

const FALLBACK_APP_ID = "app_02bd6decc052cfd1dfa2948744af6c6f";
const WORLD_NOTIFICATIONS_URL = "https://developer.world.org/api/v2/minikit/send-notification";
const recentNotifications = new Map();
const duplicateWindowMs = 1000 * 60;
const walletWindowMs = 1000 * 60;
const walletLimitPerWindow = 3;

function pruneRecentNotifications(now = Date.now()) {
  for (const [key, value] of recentNotifications.entries()) {
    if (value.expiresAt <= now) {
      recentNotifications.delete(key);
    }
  }
}

function getNotificationRateLimit({ walletAddress, title, miniAppPath }) {
  const now = Date.now();
  pruneRecentNotifications(now);

  const wallet = String(walletAddress || "").toLowerCase();
  const duplicateKey = `duplicate:${wallet}:${title}:${miniAppPath || "/orders"}`;
  const walletKey = `wallet:${wallet}`;
  const duplicate = recentNotifications.get(duplicateKey);

  if (duplicate) {
    return {
      limited: true,
      reason: "Duplicate notification skipped.",
    };
  }

  const walletBucket = recentNotifications.get(walletKey) || {
    count: 0,
    expiresAt: now + walletWindowMs,
  };

  if (walletBucket.count >= walletLimitPerWindow) {
    return {
      limited: true,
      reason: "Notification rate limit reached for this wallet.",
    };
  }

  recentNotifications.set(duplicateKey, {
    count: 1,
    expiresAt: now + duplicateWindowMs,
  });
  recentNotifications.set(walletKey, {
    count: walletBucket.count + 1,
    expiresAt: walletBucket.expiresAt,
  });

  return { limited: false };
}

function buildMiniAppPath(appId, miniAppPath = "/orders") {
  if (!miniAppPath) {
    return `worldapp://mini-app?app_id=${encodeURIComponent(appId)}&path=%2Forders`;
  }

  if (miniAppPath.startsWith("worldapp://")) {
    return miniAppPath;
  }

  const normalizedPath = miniAppPath.startsWith("/") ? miniAppPath : `/${miniAppPath}`;
  return `worldapp://mini-app?app_id=${encodeURIComponent(appId)}&path=${encodeURIComponent(normalizedPath)}`;
}

function buildNotificationPayload({ walletAddress, title, message, miniAppPath = "/orders" }) {
  const appId = process.env.APP_ID || process.env.VITE_WORLD_APP_ID || FALLBACK_APP_ID;
  return {
    app_id: appId,
    wallet_addresses: [walletAddress],
    title,
    message,
    mini_app_path: buildMiniAppPath(appId, miniAppPath),
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

    const rateLimit = getNotificationRateLimit({
      walletAddress,
      title,
      miniAppPath,
    });

    if (rateLimit.limited) {
      sendJson(res, 200, {
        sent: false,
        skipped: true,
        reason: rateLimit.reason,
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
