import { del, list, put } from "@vercel/blob";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { parseCookies } from "./_lib/cookies.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { logEvent, logSecurityEvent } from "./_lib/log.js";
import { requestIsRecognizedAdmin } from "./_lib/adminAuth.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";

// The two status transitions that finalize a trade — completed releases
// crypto/KES, rejected closes it out. Both are operator-only in the
// product (Admin fulfillment process, unchanged) and are now enforced
// here, not just hidden in the client UI: a request trying to set either
// status without a valid admin session is rejected before it reaches
// the order store. Every other transition (a user creating a draft or
// submitting their own payment reference) is untouched.
const ADMIN_ONLY_STATUSES = new Set(["completed", "rejected"]);

// The one server-verified fact about "who is calling" — read from the
// signed session cookie api/complete-siwe.js issues after a real SIWE
// verification, never from a client-supplied userId/walletAddress field
// in the request body. Every ownership check in this file is built on
// this, not on anything the caller merely asserts.
function requestUserWallet(req) {
  const cookies = parseCookies(req);
  const session = verifyUserSessionToken(cookies[USER_SESSION_COOKIE]);
  return session.valid ? session.walletAddress : null;
}

export function orderBelongsToWallet(order, wallet) {
  if (!wallet) {
    return false;
  }
  // Normalizes both sides rather than trusting the caller to have already
  // lowercased `wallet` — the real request path always does (it comes
  // straight out of verifyUserSessionToken, which normalizes on issue),
  // but this function has no way to enforce that from here, and a
  // silently-wrong ownership check is exactly the kind of bug that
  // shouldn't depend on every future caller remembering an invariant.
  const callerWallet = String(wallet).toLowerCase();
  const owned = [order.userWalletAddress, order.walletAddress]
    .filter(Boolean)
    .map((address) => String(address).toLowerCase());
  return owned.includes(callerWallet);
}

const ORDER_PREFIX = "tmpesa/orders/";
// Upstash Redis via Vercel Marketplace — preferred order store (free tier is
// ample). Falls back to Vercel Blob when Redis is not connected yet.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const REDIS_ORDERS_KEY = "tmpesa:orders";
const ADMIN_EMAIL = "brianokindo2022@gmail.com";
const FROM_EMAIL = "Tcash <onboarding@resend.dev>";
const ADMIN_WORLD_WALLET = "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc";
const FALLBACK_APP_ID = "app_02bd6decc052cfd1dfa2948744af6c6f";
const WORLD_NOTIFICATIONS_URL = "https://developer.worldcoin.org/api/v2/minikit/send-notification";
const ADMIN_NOTIFY_TIMEOUT_MS = 5000;

function redisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function redisCommand(command) {
  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Tcash order store command ${command[0]} failed.`);
  }

  return payload.result;
}

function parseStoredOrder(value) {
  try {
    const payload = JSON.parse(value);
    const order = payload?.order || payload;

    if (!isOrderRecord(order)) {
      return null;
    }

    return { ...order, adminSyncedAt: payload?.syncedAt || "" };
  } catch {
    return null;
  }
}

async function readRedisOrders() {
  const values = await redisCommand(["HVALS", REDIS_ORDERS_KEY]);
  return (values || []).map(parseStoredOrder).filter(Boolean);
}

async function writeRedisOrders(orders, syncedAt) {
  // Stale-write guard: a device backfilling old local copies must not clobber
  // a newer status the admin already set.
  const existingValues = await redisCommand([
    "HMGET",
    REDIS_ORDERS_KEY,
    ...orders.map((order) => order.id),
  ]);
  const hsetArgs = ["HSET", REDIS_ORDERS_KEY];

  orders.forEach((order, index) => {
    const existing = existingValues?.[index] ? parseStoredOrder(existingValues[index]) : null;

    if (existing && sortOrders(order, existing) > 0) {
      return;
    }

    hsetArgs.push(order.id, JSON.stringify({ order, syncedAt }));
  });

  if (hsetArgs.length > 2) {
    await redisCommand(hsetArgs);
  }
}

function sanitizeOrderId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

// Bounds are generous relative to real usage (a bureau-de-change trade
// batch is never more than a handful of orders, and no legitimate free
// -text field here — a phone number, a wallet address, an M-Pesa code —
// approaches these lengths) but stop a single request from writing an
// unbounded number of records or absurdly large strings into the store.
const MAX_ORDERS_PER_REQUEST = 20;
const MAX_STRING_FIELD_LENGTH = 256;
const MAX_AMOUNT_VALUE = 1_000_000_000;

export function isBoundedString(value, maxLength = MAX_STRING_FIELD_LENGTH) {
  return typeof value !== "string" || value.length <= maxLength;
}

export function isSaneAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT_VALUE;
}

export function isOrderRecord(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const stringFields = [
    "id",
    "walletAddress",
    "destinationUsername",
    "payoutPhoneNumber",
    "paymentReference",
    "userLabel",
    "userPhone",
    "userWalletAddress",
    "referredByCode",
    "humanVerificationStatus",
    "humanVerificationLevel",
  ];

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 90 &&
    ["buy", "sell"].includes(value.type) &&
    typeof value.asset === "string" &&
    value.asset.length <= 16 &&
    isSaneAmount(value.cryptoAmount) &&
    isSaneAmount(value.kesAmount) &&
    stringFields.every((field) => isBoundedString(value[field]))
  );
}

export function normalizeOrders(value) {
  const orders = Array.isArray(value.orders) ? value.orders : [value.order];
  return orders.slice(0, MAX_ORDERS_PER_REQUEST).filter(isOrderRecord);
}

export function sortOrders(first, second) {
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
    : order?.userLabel || "Tcash user";
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
    subject: `Tcash ${order.type?.toUpperCase()} order - ${order.cryptoAmount} ${order.asset}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0f1a;color:#f5f7ff;padding:24px">
        <div style="max-width:620px;margin:0 auto;background:#111827;border:1px solid #273348;border-radius:18px;padding:22px">
          <p style="color:#9fb1d1;margin:0 0 8px">Tcash admin notification</p>
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
          <p style="color:#9fb1d1;margin:18px 0 0">Open Tcash admin to pay and mark this order completed.</p>
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
          title: "New Tcash order",
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

// Payment replay / duplicate-submission guard: a paymentReference is
// either a self-reported M-Pesa code (buy) or a MiniKit World Pay
// transactionId (sell) — both are the one piece of evidence that money
// actually moved. Nothing previously stopped the *same* reference from
// being attached to a second, different order id, which would let one
// real payment be claimed as proof for multiple payouts. This checks
// the reference against every other stored order before a paid/
// completed write is accepted.
async function findOrderByPaymentReference(reference, excludeOrderId) {
  if (!reference) {
    return null;
  }

  const orders = redisConfigured() ? await readRedisOrders() : await readAllBlobOrders();
  return orders.find((order) => order.paymentReference === reference && order.id !== excludeOrderId) || null;
}

async function readAllBlobOrders() {
  const blobs = await listOrderBlobs();
  const snapshots = await Promise.all(blobs.map(readOrderBlob));
  return snapshots.filter(Boolean);
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

  if (!redisConfigured() && !process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 200, {
      ok: false,
      pendingSetup: true,
      orders: [],
      message:
        "Connect Upstash Redis (or set BLOB_READ_WRITE_TOKEN) so Tcash can share orders with admin.",
    });
    return;
  }

  if (req.method === "GET") {
    // Every order record carries phone numbers, wallet addresses, and KES
    // amounts — this used to be returned to any caller, authenticated or
    // not. An admin session sees everything (the operator desk's actual
    // job); a regular user session sees only orders their own verified
    // wallet placed; anyone else gets nothing.
    const isAdmin = requestIsRecognizedAdmin(req);
    const callerWallet = isAdmin ? null : requestUserWallet(req);

    if (!isAdmin && !callerWallet) {
      logSecurityEvent("orders.unauthorized_read", {});
      sendJson(res, 401, { ok: false, orders: [], error: "Sign in to view orders." });
      return;
    }

    const scopeToCaller = (orders) =>
      isAdmin ? orders : orders.filter((order) => orderBelongsToWallet(order, callerWallet));

    if (redisConfigured()) {
      try {
        const orders = await readRedisOrders();
        sendJson(res, 200, { ok: true, orders: scopeToCaller(orders).sort(sortOrders) });
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
        orders: scopeToCaller(Array.from(latestById.values())).sort(sortOrders),
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
        error: "Send at least one valid Tcash order.",
      });
      return;
    }

    const attemptsAdminStatus = orders.some((order) => ADMIN_ONLY_STATUSES.has(order.status));
    const isAdmin = requestIsRecognizedAdmin(req);

    if (attemptsAdminStatus && !isTrustedOrigin(req)) {
      logSecurityEvent("order_status.blocked_origin", { orderIds: orders.map((o) => o.id) });
      sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
      return;
    }

    if (attemptsAdminStatus && !isAdmin) {
      logSecurityEvent("order_status.unauthorized_attempt", {
        orderIds: orders.map((o) => o.id),
        attemptedStatuses: orders.map((o) => o.status),
      });
      sendJson(res, 403, {
        ok: false,
        error: "Only a signed-in Tcash operator can complete or reject an order.",
      });
      return;
    }

    // Ownership enforcement for everything else: the admin desk manages
    // every user's orders by design (that's the entire point of it), so
    // an admin session skips this. Anyone else must be a real,
    // SIWE-verified session, and every order in the batch must actually
    // belong to that wallet — a client-supplied userId/walletAddress
    // field is never enough on its own, only what the signed session
    // cookie says.
    if (!isAdmin) {
      const callerWallet = requestUserWallet(req);

      if (!callerWallet) {
        logSecurityEvent("orders.unauthorized_write", { orderIds: orders.map((o) => o.id) });
        sendJson(res, 401, { ok: false, error: "Sign in to save this order." });
        return;
      }

      const foreignOrder = orders.find((order) => !orderBelongsToWallet(order, callerWallet));

      if (foreignOrder) {
        logSecurityEvent("orders.ownership_mismatch", {
          orderId: foreignOrder.id,
          callerWallet,
        });
        sendJson(res, 403, { ok: false, error: "This order does not belong to your wallet." });
        return;
      }
    }

    for (const order of orders) {
      if (!order.paymentReference) {
        continue;
      }

      const conflict = await findOrderByPaymentReference(order.paymentReference, order.id).catch(() => null);

      if (conflict) {
        logSecurityEvent("order.payment_reference_replay_blocked", {
          orderId: order.id,
          conflictingOrderId: conflict.id,
          reference: order.paymentReference,
        });
        sendJson(res, 409, {
          ok: false,
          error: "This payment reference is already attached to a different order.",
        });
        return;
      }
    }

    for (const order of orders) {
      logEvent("order.status_write", {
        orderId: order.id,
        type: order.type,
        asset: order.asset,
        status: order.status,
        isAdminAction: ADMIN_ONLY_STATUSES.has(order.status),
      });
    }

    const syncedAt = new Date().toISOString();

    if (redisConfigured()) {
      await writeRedisOrders(orders, syncedAt);
    } else {
      await Promise.all(
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
    }

    const shouldNotifyAdmin = payload.notifyAdmin !== false;
    const adminNotifications = shouldNotifyAdmin
      ? await Promise.all(orders.map((order) => notifyAdminForOrder(order)))
      : [];

    sendJson(res, 200, {
      ok: true,
      count: orders.length,
      syncedAt,
      adminNotifications,
    });
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to sync admin order.",
    });
  }
}
