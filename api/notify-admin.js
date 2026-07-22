import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";

// Combines what were two near-identical endpoints (notify-order,
// notify-referral) into one — both just build an admin notification
// email via Resend and differ only in which fields go in the table.
// Merged specifically to stay under Vercel's per-deployment serverless
// function count on the Hobby plan, not for any architectural reason;
// dispatched by payload shape (order vs. eventType) rather than an
// explicit type field, so the two existing call sites in
// notificationService.js didn't need their payload shapes changed.

const ADMIN_EMAIL = "brianokindo2022@gmail.com";
const FROM_EMAIL = "Tcash <onboarding@resend.dev>";

// World App push notifications used to live in their own endpoint
// (api/send-world-notification.js). Folded in here for the same reason
// notify-order/notify-referral were merged in the first place: every
// top-level api/ file is its own serverless function and the Hobby plan
// caps a deployment at 12. Dispatched by payload shape like the others —
// a push carries walletAddress/title/message, an email payload doesn't.
const FALLBACK_APP_ID = "app_02bd6decc052cfd1dfa2948744af6c6f";
const WORLD_NOTIFICATIONS_URL = "https://developer.worldcoin.org/api/v2/minikit/send-notification";
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

  if (recentNotifications.get(duplicateKey)) {
    return { limited: true, reason: "Duplicate notification skipped." };
  }

  const walletBucket = recentNotifications.get(walletKey) || {
    count: 0,
    expiresAt: now + walletWindowMs,
  };

  if (walletBucket.count >= walletLimitPerWindow) {
    return { limited: true, reason: "Notification rate limit reached for this wallet." };
  }

  recentNotifications.set(duplicateKey, { count: 1, expiresAt: now + duplicateWindowMs });
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
    localisations: [
      {
        language: "en",
        title: String(title || "").slice(0, 64),
        message: String(message || "").slice(0, 180),
      },
    ],
    mini_app_path: buildMiniAppPath(appId, miniAppPath),
  };
}

async function sendWorldNotification(res, { walletAddress, title, message, miniAppPath }) {
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

  const rateLimit = getNotificationRateLimit({ walletAddress, title, miniAppPath });

  if (rateLimit.limited) {
    sendJson(res, 200, { sent: false, skipped: true, reason: rateLimit.reason });
    return;
  }

  const response = await fetch(WORLD_NOTIFICATIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildNotificationPayload({ walletAddress, title, message, miniAppPath }),
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

  sendJson(res, 200, { sent: true, result: payload });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEmail({ kicker, title, rows }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#15130f;color:#f6f1e7;padding:24px">
      <div style="max-width:620px;margin:0 auto;background:#1e1b15;border:1px solid #3a3228;border-radius:18px;padding:22px">
        <p style="color:#a79c87;margin:0 0 8px">${escapeHtml(kicker)}</p>
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 18px">${escapeHtml(title)}</h1>
        <table style="width:100%;border-collapse:collapse">
          ${rows
            .filter(([, value]) => value)
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding:10px;border-top:1px solid #3a3228;color:#a79c87">${escapeHtml(label)}</td>
                  <td style="padding:10px;border-top:1px solid #3a3228;text-align:right;color:#f6f1e7">${escapeHtml(value)}</td>
                </tr>
              `,
            )
            .join("")}
        </table>
        <p style="color:#9fb1d1;margin:18px 0 0">
          Open the Tcash admin dashboard to review and complete this.
        </p>
      </div>
    </div>
  `;
}

function formatCryptoAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : value;
}

function buildOrderEmail(order) {
  const isSell = order.type === "sell";
  const title = isSell
    ? "New sell order — send the M-Pesa payout after checking the World payment"
    : "New buy order — confirm the M-Pesa payment before releasing crypto";
  const cryptoAmount = formatCryptoAmount(order.cryptoAmount);

  return {
    subject: `Tcash ${order.type?.toUpperCase()} order — ${cryptoAmount} ${order.asset}`,
    idempotencyKey: `tmpesa-order-${order.id}`,
    html: renderEmail({
      kicker: "Tcash admin notification",
      title,
      rows: [
        ["Order ID", order.id],
        ["Type", order.type?.toUpperCase()],
        ["Asset", order.asset],
        ["Crypto Amount", cryptoAmount],
        [isSell ? "KES Payout" : "KES To Pay", `KES ${Number(order.kesAmount || 0).toLocaleString()}`],
        ["Status", order.status],
        ["User", order.userLabel],
        ["Login Phone", order.userPhone],
        ["M-Pesa Payout", order.payoutPhoneNumber || order.userMpesaPhoneNumber],
        ["World Username", order.destinationUsername ? `@${order.destinationUsername}` : ""],
        ["Wallet", order.walletAddress || order.userWalletAddress],
        ["Created", order.createdAt],
      ],
    }),
  };
}

function buildReferralEmail(payload) {
  const subject =
    payload.eventType === "milestone"
      ? `Tcash referral milestone reached — ${payload.eligibleRewardKes ? `KES ${payload.eligibleRewardKes}` : "reward pending"}`
      : "Tcash new referral signup";

  return {
    subject,
    idempotencyKey: `tmpesa-referral-${payload.eventType}-${payload.referralCode}-${payload.referredWalletAddress || payload.referredUsername || payload.createdAt}`,
    html: renderEmail({
      kicker: "Tcash referral notification",
      title: subject,
      rows: [
        ["Event", payload.eventType],
        ["Referrer", payload.referrerUsername ? `@${payload.referrerUsername}` : payload.referrerLabel],
        ["Referral Code", payload.referralCode],
        ["Referred User", payload.referredUsername ? `@${payload.referredUsername}` : payload.referredLabel],
        ["Referred Wallet", payload.referredWalletAddress],
        ["Referrer M-Pesa", payload.referrerMpesaPhoneNumber],
        ["Activated Users", payload.activatedUsers],
        ["Referred Users", payload.referredUsers],
        ["Eligible Reward", payload.eligibleRewardKes ? `KES ${payload.eligibleRewardKes}` : ""],
        ["Created", payload.createdAt],
      ],
    }),
  };
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const payload = await readJsonBody(req);

    // World App push notification — handled entirely separately from the
    // Resend email paths below (different upstream, different response shape).
    if (payload?.walletAddress && payload?.title && payload?.message) {
      await sendWorldNotification(res, payload);
      return;
    }

    let email;
    let errorMessage;

    if (payload?.order?.id && payload?.order?.type) {
      email = buildOrderEmail(payload.order);
    } else if (payload?.eventType && payload?.referralCode) {
      email = buildReferralEmail(payload);
    } else {
      errorMessage = payload?.order
        ? "Missing order details."
        : "Missing referral event details.";
    }

    if (!email) {
      sendJson(res, 400, { notified: false, error: errorMessage });
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      sendJson(res, 200, {
        notified: false,
        skipped: true,
        reason: "RESEND_API_KEY is not configured.",
      });
      return;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.ORDER_EMAIL_FROM || FROM_EMAIL,
        to: process.env.ORDER_NOTIFICATION_EMAIL || ADMIN_EMAIL,
        subject: email.subject,
        html: email.html,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      sendJson(res, response.status, {
        notified: false,
        error: result?.message || "Unable to send notification.",
      });
      return;
    }

    sendJson(res, 200, { notified: true, id: result.id });
  } catch (error) {
    sendJson(res, 500, {
      notified: false,
      error: error instanceof Error ? error.message : "Unable to notify admin.",
    });
  }
}
