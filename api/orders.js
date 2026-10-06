import { getFreshMarketQuote } from "./world-prices.js";
import { priceOrder } from "./_lib/quote.js";
import { randomUUID } from "node:crypto";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { parseCookies } from "./_lib/cookies.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { logAdminAction, logEvent, logSecurityEvent } from "./_lib/log.js";
import { getRequestAdminWallet, requestIsRecognizedAdmin } from "./_lib/adminAuth.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";
import {
  HIGH_VALUE_KES_THRESHOLD,
  isWalletVerified,
  worldIdVerificationAvailable,
} from "./_lib/worldId.js";

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

// Personal order records must stay in private Redis storage.
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
    signal: AbortSignal.timeout(8000),
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

export const ATOMIC_ORDER_WRITE = `
local incoming = cjson.decode(ARGV[1])
local syncedAt = ARGV[2]
local wallet = ARGV[3]
local admin = ARGV[4] == 'true'
local all = redis.call('HVALS', KEYS[1])
local refs = {}
for _, raw in ipairs(all) do
  local decoded = cjson.decode(raw)
  local saved = decoded.order or decoded
  if saved.paymentReference and saved.paymentReference ~= '' then refs[string.upper(saved.paymentReference)] = saved.id end
end
for _, order in ipairs(incoming) do
  local raw = redis.call('HGET', KEYS[1], order.id)
  if raw then
    local decoded = cjson.decode(raw)
    local saved = decoded.order or decoded
    if not admin and string.lower(saved.userWalletAddress or saved.walletAddress or '') ~= wallet then return redis.error_reply('Order ownership conflict') end
    for _, field in ipairs({'type','asset','cryptoAmount','kesAmount','grossKesAmount','feeKesAmount','feePerCoinKes','walletAddress','userWalletAddress','payoutPhoneNumber','createdAt','sellWalletAddress','mpesaPaybillNumber','mpesaAccountNumber','mpesaTillName'}) do
      if saved[field] ~= order[field] then return redis.error_reply('Order details cannot change') end
    end
    if (saved.status == 'completed' or saved.status == 'rejected' or saved.status == 'cancelled') and order.status ~= saved.status then return redis.error_reply('Closed order cannot reopen') end
    if not admin and saved.status == 'paid' and order.status ~= 'paid' then return redis.error_reply('Submitted payment cannot reset') end
    if saved.paymentReference and saved.paymentReference ~= '' and saved.paymentReference ~= order.paymentReference then return redis.error_reply('Payment reference cannot change') end
  end
  if order.paymentReference and order.paymentReference ~= '' then
    local ref = string.upper(order.paymentReference)
    if refs[ref] and refs[ref] ~= order.id then return redis.error_reply('Payment reference already used') end
    refs[ref] = order.id
  end
end
for index, order in ipairs(incoming) do
  redis.call('HSET', KEYS[1], order.id, ARGV[4 + index])
end
return #incoming
`;
async function writeRedisOrders(orders, syncedAt, wallet, isAdmin) {
  await redisCommand(["EVAL", ATOMIC_ORDER_WRITE, 1, REDIS_ORDERS_KEY, JSON.stringify(orders), syncedAt, wallet || "", String(isAdmin), ...orders.map(order => JSON.stringify({ order, syncedAt }))]);
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
  ];

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 90 &&
    ["buy", "sell"].includes(value.type) &&
    ["WLD", "USDC"].includes(value.asset) &&
    (!value.status || ["pending", "paid", "completed", "rejected", "cancelled"].includes(value.status)) &&
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

// Raw order.cryptoAmount is a float that routinely carries full binary
// precision (e.g. 21.070209563997295 WLD). The UI has always formatted it;
// the admin email/push copy did not, so operators saw the raw value. Mirrors
// api/notify-admin.js's helper rather than importing the client's, since api/
// functions don't pull from src/.
function formatCryptoAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : value;
}

function buildOrderEmail(order) {
  const isSell = order.type === "sell";
  const rows = [
    ["Order ID", order.id],
    ["Type", order.type?.toUpperCase()],
    ["Asset", order.asset],
    ["Crypto Amount", `${formatCryptoAmount(order.cryptoAmount)} ${order.asset}`],
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
    subject: `Tcash ${order.type?.toUpperCase()} order - ${formatCryptoAmount(order.cryptoAmount)} ${order.asset}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#15130f;color:#f6f1e7;padding:24px">
        <div style="max-width:620px;margin:0 auto;background:#1e1b15;border:1px solid #3a3228;border-radius:18px;padding:22px">
          <p style="color:#a79c87;margin:0 0 8px">Tcash admin notification</p>
          <h1 style="font-size:22px;line-height:1.25;margin:0 0 18px">
            ${escapeHtml(isSell ? "New sell order needs M-Pesa payout" : "New buy order needs confirmation")}
          </h1>
          <table style="width:100%;border-collapse:collapse">
            ${rows
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
          <p style="color:#a79c87;margin:18px 0 0">Open Tcash admin to pay and mark this order completed.</p>
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
          message: `${getOrderUserLabel(order)} placed a ${order.type} order for ${formatCryptoAmount(order.cryptoAmount)} ${order.asset}.`,
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

async function findOrderByPaymentReference(reference, excludeOrderId) {
  if (!reference) return null;
  const orders = await readRedisOrders();
  return orders.find(order => String(order.paymentReference || "").toUpperCase() === String(reference).toUpperCase() && order.id !== excludeOrderId) || null;
}

export function assertOrderUpdate(existing, incoming, callerWallet, isAdmin) {
  if (!isAdmin && !orderBelongsToWallet(incoming, callerWallet)) throw new Error("This order does not belong to your wallet.");
  if (Number(incoming.cryptoAmount) <= 0 || Number(incoming.kesAmount) <= 0) throw new Error("Enter a positive trade amount.");
  if (incoming.type === "buy" && (Number(incoming.kesAmount) < 600 || Number(incoming.kesAmount) > 20000)) throw new Error("Buy orders must be between KES 600 and KES 20,000.");
  if (incoming.type === "sell" && !/^0[17]\d{8}$/.test(incoming.payoutPhoneNumber || "")) throw new Error("Enter a valid Kenyan payout number.");
  if (["paid", "completed"].includes(incoming.status) && !incoming.paymentReference) throw new Error("A submitted payment requires a reference.");
  if (incoming.type === "buy" && incoming.paymentReference && !/^[A-Z0-9]{10}$/.test(incoming.paymentReference)) throw new Error("Enter a valid M-Pesa code.");
  if (!existing) return;
  if (!isAdmin && !orderBelongsToWallet(existing, callerWallet)) throw new Error("This order does not belong to your wallet.");
  const immutable = ["type", "asset", "cryptoAmount", "kesAmount", "grossKesAmount", "feeKesAmount", "feePerCoinKes", "walletAddress", "userWalletAddress", "payoutPhoneNumber", "createdAt", "sellWalletAddress", "mpesaPaybillNumber", "mpesaAccountNumber", "mpesaTillName"];
  if (immutable.some(field => existing[field] !== incoming[field])) throw new Error("Order amounts and destinations cannot change after creation.");
  if (["completed", "rejected", "cancelled"].includes(existing.status) && incoming.status !== existing.status) throw new Error("A closed order cannot be reopened.");
  if (existing.paymentReference && incoming.paymentReference !== existing.paymentReference) throw new Error("A submitted payment reference cannot be replaced.");
  if (!isAdmin && existing.status === "paid" && incoming.status !== "paid") throw new Error("A submitted payment cannot be reset.");
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST"])) {
    return;
  }

  if (!redisConfigured()) {
    sendJson(res, 503, {
      ok: false,
      pendingSetup: true,
      orders: [],
      message:
        "The order desk is unavailable. Please contact Tcash support before paying.",
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

    return;
  }

  try {
    const payload = await readJsonBody(req);
    let orders = normalizeOrders(payload);

    if (!orders.length) {
      sendJson(res, 400, {
        ok: false,
        error: "Send at least one valid Tcash order.",
      });
      return;
    }

    if (!isTrustedOrigin(req)) {
      sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
      return;
    }
    const attemptsAdminStatus = orders.some((order) => ADMIN_ONLY_STATUSES.has(order.status));
    const isAdmin = requestIsRecognizedAdmin(req);
    const adminWallet = isAdmin ? getRequestAdminWallet(req) : null;
    const requestId = randomUUID();

    if (attemptsAdminStatus && !isTrustedOrigin(req)) {
      logSecurityEvent("order_status.blocked_origin", { orderIds: orders.map((o) => o.id) });
      if (isAdmin) {
        for (const order of orders.filter((o) => ADMIN_ONLY_STATUSES.has(o.status))) {
          logAdminAction({
            requestId,
            administrator: adminWallet,
            action: `order.status.${order.status}`,
            target: order.id,
            result: "denied",
            reason: "untrusted_origin",
          });
        }
      }
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

      // World ID gate for high-value orders. Only enforced once the feature
      // is actually configured (signing key + store present) — before that
      // this is a no-op and orders flow exactly as before. Verification is
      // one-time per wallet: a wallet that has ever passed proof-of-human
      // for this action clears the gate for all subsequent high-value
      // orders. Admin writes never reach here (the desk manages every
      // user's orders by design).
      if (worldIdVerificationAvailable()) {
        const hasHighValueOrder = orders.some(
          (order) => Number(order.kesAmount) >= HIGH_VALUE_KES_THRESHOLD,
        );

        if (hasHighValueOrder) {
          const verified = await isWalletVerified(callerWallet).catch(() => false);

          if (!verified) {
            logSecurityEvent("orders.high_value_unverified", {
              callerWallet,
              orderIds: orders
                .filter((order) => Number(order.kesAmount) >= HIGH_VALUE_KES_THRESHOLD)
                .map((order) => order.id),
            });
            sendJson(res, 403, {
              ok: false,
              requiresWorldId: true,
              error: "Verify with World ID to place high-value orders.",
            });
            return;
          }
        }
      }
    }

    const stored = await readRedisOrders();
    const fresh = orders.filter(order => !stored.some(saved => saved.id === order.id));
    if (fresh.some(order => order.status !== "pending" || order.paymentReference)) {
      sendJson(res, 409, { ok: false, error: "Start and save an order before paying. Contact support for an existing payment." }); return;
    }
    if (fresh.length) {
      const [market, settingsRaw] = await Promise.all([getFreshMarketQuote(), redisCommand(["GET", "tmpesa:settings"])]);
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const now = new Date().toISOString();
      orders = orders.map(order => fresh.includes(order) ? priceOrder({ ...order, createdAt: now, updatedAt: now }, market, settings) : order);
    }
    if (!isAdmin && orders.some(order => Number(order.kesAmount) >= HIGH_VALUE_KES_THRESHOLD)) {
      if (!worldIdVerificationAvailable()) { sendJson(res, 503, { ok: false, error: "High-value trades are unavailable until identity verification is configured. Contact support." }); return; }
      if (!await isWalletVerified(requestUserWallet(req))) { sendJson(res, 403, { ok: false, requiresWorldId: true, error: "Verify with World ID before placing a high-value trade." }); return; }
    }
    for (const order of orders) {
      assertOrderUpdate(stored.find(existing => existing.id === order.id), order, requestUserWallet(req), isAdmin);
    }
    const batchReferences = orders.map(order => String(order.paymentReference || "").toUpperCase()).filter(Boolean);
    if (new Set(batchReferences).size !== batchReferences.length) {
      sendJson(res, 409, { ok: false, error: "A payment reference can only be used once." });
      return;
    }
    for (const order of orders) {
      if (!order.paymentReference) {
        continue;
      }

      const conflict = await findOrderByPaymentReference(order.paymentReference, order.id);

      if (conflict) {
        logSecurityEvent("order.payment_reference_replay_blocked", {
          orderId: order.id,
          conflictingOrderId: conflict.id,
          reference: order.paymentReference,
        });
        if (isAdmin && ADMIN_ONLY_STATUSES.has(order.status)) {
          logAdminAction({
            requestId,
            administrator: adminWallet,
            action: `order.status.${order.status}`,
            target: order.id,
            result: "failed",
            reason: "payment_reference_replay",
          });
        }
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

    const adminActionOrders = isAdmin
      ? orders.filter((order) => ADMIN_ONLY_STATUSES.has(order.status))
      : [];
    const syncedAt = new Date().toISOString();

    try {
      await writeRedisOrders(orders, syncedAt, requestUserWallet(req), isAdmin);
    } catch (writeError) {
      for (const order of adminActionOrders) {
        logAdminAction({
          requestId,
          administrator: adminWallet,
          action: `order.status.${order.status}`,
          target: order.id,
          result: "failed",
          reason: "store_write_error",
        });
      }
      throw writeError;
    }

    // The write above is the actual privileged effect — this is the
    // audit record's "result" only fires once that effect is confirmed,
    // never optimistically before it, so this log can never claim
    // "success" for something that didn't actually happen.
    for (const order of adminActionOrders) {
      logAdminAction({
        requestId,
        administrator: adminWallet,
        action: `order.status.${order.status}`,
        target: order.id,
        result: "success",
      });
    }

    const shouldNotifyAdmin = payload.notifyAdmin !== false;
    const adminNotifications = shouldNotifyAdmin
      ? await Promise.all(orders.map((order) => notifyAdminForOrder(order)))
      : [];

    sendJson(res, 200, {
      ok: true,
      count: orders.length,
      orders,
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
