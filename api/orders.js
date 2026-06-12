import { del, list, put } from "@vercel/blob";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";

const ORDER_PREFIX = "tmpesa/orders/";
const ADMIN_EMAIL = "brianokindo2022@gmail.com";
const FROM_EMAIL = "TMpesa <onboarding@resend.dev>";
const ADMIN_WORLD_WALLET = "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc";
const FALLBACK_APP_ID = "app_02bd6decc052cfd1dfa2948744af6c6f";
const WORLD_NOTIFICATIONS_URL = "https://developer.worldcoin.org/api/v2/minikit/send-notification";
const ADMIN_NOTIFY_TIMEOUT_MS = 5000;

function sanitizeOrderId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function isOrderRecord(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    ["buy", "sell"].includes(value.type) &&
    typeof value.asset === "string" &&
    Number.isFinite(Number(value.cryptoAmount)) &&
    Number.isFinite(Number(value.kesAmount))
  );
}

function normalizeOrders(value) {
  const orders = Array.isArray(value.orders) ? value.orders : [value.order];
  return orders.filter(isOrderRecord);
}

function sortOrders(first, second) {
  const firstDate = new Date(first.updatedAt || first.createdAt || 0).getTime();
  const secondDate = new Date(second.updatedAt || second.createdAt || 0).getTime();
  return secondDate - firstDate;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildMiniAppPath(appId, miniAppPath = "/tmpesa-admin") {
  const normalizedPath = miniAppPath.startsWith("/") ? miniAppPath : `/${miniAppPath}`;
  return `worldapp://mini-app?app_id=${encodeURIComponent(appId)}&path=${encodeURIComponent(normalizedPath)}`;
}

function getOrderUserLabel(order) {
  return order?.destinationUsername
    ? `@${order.destinationUsername}`
    : order?.userLabel || "TMpesa user";
}

async function fetchWithTimeout(url, options, timeoutMs = ADMIN_NOTIFY_TIMEOUT_MS) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    return await fetch(url, {
      ...options,
      signal: controller?.signal,
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function buildOrderEmail(order) {
  const isSell = order.type === "sell";
  const rows = [
    ["Order ID", order.id],
    ["Type", order.type?.toUpperCase()],
    ["Asset", order.asset],
    ["Crypto Amount", order.cryptoAmount],
    [isSell ? "KES Payout" : "KES To Pay", `KES ${Number(order.kesAmount || 0).toLocaleString()}`],
    ["Status", order.status],
    ["User", getOrderUserLabel(order)],
    ["Login Phone", order.userPhone],
    ["M-Pesa Payout", order.payoutPhoneNumber || order.userMpesaPhoneNumber],
    ["World Username", order.destinationUsername ? `@${order.destinationUsername}` : ""],
    ["Wallet", order.walletAddress || order.userWalletAddress],
    ["Created", order.createdAt],
  ].filter(([, value]) => value);

  return {
    subject: `TMpesa ${order.type?.toUpperCase()} order - ${order.cryptoAmount} ${order.asset}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0f1a;color:#f5f7ff;padding:24px">
        <div style="max-width:620px;margin:0 auto;background:#111827;border:1px solid #273348;border-radius:18px;padding:22px">
          <p style="color:#9fb1d1;margin:0 0 8px">TMpesa admin notification</p>
          <h1 style="font-size:22px;line-height:1.25;margin:0 0 18px">
            ${escapeHtml(isSell ? "New sell order needs M-Pesa payout" : "New buy order needs confirmation")}
          </h1>
          <table style="width:100%;border-collapse:collapse">
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <td style="padding:10px;border-top:1px solid #273348;color:#9fb1d1">${escapeHtml(label)}</td>
                    <td style="padding:10px;border-top:1px solid #273348;text-align:right;color:#ffffff">${escapeHtml(value)}</td>
                  </tr>
                `,
              )
              .join("")}
          </table>
          <p style="color:#9fb1d1;margin:18px 0 0">Open TMpesa admin to pay and mark this order completed.</p>
        </div>
      </div>
    `,
  };
}

async function notifyAdminEmail(order) {
  if (!process.env.RESEND_API_KEY) {
    return { notified: false, skipped: true, reason: "RESEND_API_KEY is not configured." };
  }

  const email = buildOrderEmail(order);
  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `tmpesa-order-${order.id}-${order.status || "pending"}`,
    },
    body: JSON.stringify({
      from: process.env.ORDER_EMAIL_FROM || FROM_EMAIL,
      to: process.env.ORDER_NOTIFICATION_EMAIL || ADMIN_EMAIL,
      subject: email.subject,
      html: email.html,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { notified: false, error: payload?.message || "Unable to send order email." };
  }

  return { notified: true, id: payload.id };
}

async function notifyAdminWorld(order) {
  const apiKey =
    process.env.WORLD_NOTIFICATION_API_KEY ||
    process.env.DEV_PORTAL_API_KEY ||
    process.env.WORLD_API_KEY;

  if (!apiKey) {
    return { sent: false, skipped: true, reason: "WORLD notification API key is not configured." };
  }

  const appId = process.env.APP_ID || process.env.VITE_WORLD_APP_ID || FALLBACK_APP_ID;
  const response = await fetchWithTimeout(WORLD_NOTIFICATIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      wallet_addresses: [process.env.ADMIN_WORLD_WALLET || ADMIN_WORLD_WALLET],
      localisations: [
        {
          language: "en",
          title: "New TMpesa order",
          message: `${getOrderUserLabel(order)} placed a ${order.type} order for ${order.cryptoAmount} ${order.asset}.`,
        },
      ],
      mini_app_path: buildMiniAppPath(appId, "/tmpesa-admin"),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { sent: false, error: payload?.message || payload?.error || "Unable to send World notification." };
  }

  return { sent: true, result: payload };
}

async function notifyAdminForOrder(order) {
  if (order.status && !["pending", "paid"].includes(order.status)) {
    return { skipped: true, reason: "Order status does not need admin placement notification." };
  }

  const [emailResult, worldResult] = await Promise.allSettled([
    notifyAdminEmail(order),
    notifyAdminWorld(order),
  ]);

  return {
    email: emailResult.status === "fulfilled" ? emailResult.value : { notified: false },
    world: worldResult.status === "fulfilled" ? worldResult.value : { sent: false },
  };
}

async function readOrderBlob(blob) {
  try {
    const response = await fetch(blob.url, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const order = payload?.order || payload;

    if (!isOrderRecord(order)) {
      return null;
    }

    return {
      ...order,
      adminQueueUrl: blob.url,
      adminSyncedAt: payload.syncedAt || String(blob.uploadedAt || ""),
    };
  } catch {
    return null;
  }
}

async function listOrderBlobs() {
  const blobs = [];
  let cursor;

  do {
    const result = await list({
      limit: 1000,
      prefix: ORDER_PREFIX,
      cursor,
    });

    blobs.push(...result.blobs);
    cursor = result.cursor;

    if (!result.hasMore) {
      break;
    }
  } while (cursor);

  return blobs;
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST"])) {
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 200, {
      ok: false,
      pendingSetup: true,
      orders: [],
      message: "Set BLOB_READ_WRITE_TOKEN so TMpesa can share orders with admin.",
    });
    return;
  }

  if (req.method === "GET") {
    try {
      const blobs = await listOrderBlobs();
      const snapshots = await Promise.all(blobs.map(readOrderBlob));
      const latestById = new Map();

      for (const order of snapshots.filter(Boolean)) {
        const current = latestById.get(order.id);

        if (!current || sortOrders(order, current) < 0) {
          latestById.set(order.id, order);
        }
      }

      // Purge superseded/legacy timestamped blobs so the store stays at one
      // blob per order instead of growing forever (capped per request).
      // Only when at least one blob read succeeded — if every read failed the
      // problem is transient (CDN/suspension), not stale data, so keep it all.
      if (latestById.size > 0) {
        const keepUrls = new Set(
          Array.from(latestById.values()).map((order) => order.adminQueueUrl),
        );
        const staleUrls = blobs
          .map((blob) => blob.url)
          .filter((url) => !keepUrls.has(url))
          .slice(0, 500);

        if (staleUrls.length) {
          await del(staleUrls).catch(() => null);
        }
      }

      sendJson(res, 200, {
        ok: true,
        orders: Array.from(latestById.values()).sort(sortOrders),
      });
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        orders: [],
        error: error instanceof Error ? error.message : "Unable to load admin orders.",
      });
    }
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const orders = normalizeOrders(payload);

    if (!orders.length) {
      sendJson(res, 400, {
        ok: false,
        error: "Send at least one valid TMpesa order.",
      });
      return;
    }

    const syncedAt = new Date().toISOString();
    const blobs = await Promise.all(
      orders.map((order) => {
        const orderId = sanitizeOrderId(order.id);

        // One canonical blob per order, overwritten in place — appending a
        // timestamped blob per sync is what blew the store's free quota.
        return put(
          `${ORDER_PREFIX}${orderId}.json`,
          JSON.stringify({ order, syncedAt }, null, 2),
          {
            access: "public",
            allowOverwrite: true,
            contentType: "application/json",
          },
        );
      }),
    );
    const shouldNotifyAdmin = payload.notifyAdmin !== false;
    const adminNotifications = shouldNotifyAdmin
      ? await Promise.all(orders.map((order) => notifyAdminForOrder(order)))
      : [];

    sendJson(res, 200, {
      ok: true,
      count: orders.length,
      syncedAt,
      urls: blobs.map((blob) => blob.url),
      adminNotifications,
    });
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to sync admin order.",
    });
  }
}
