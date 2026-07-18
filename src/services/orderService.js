import { STORAGE_KEYS } from "../config/appConfig";
import { fetchAdminOrderQueue, syncAdminOrder, syncAdminOrders } from "./backendService";
import { getCurrentUser } from "./authService";
import { readStorage, writeStorage } from "./localStorage";
import {
  notifyAdminOrderCreated,
  notifyAdminReferralEvent,
  notifyWorldUserOrderCreated,
  notifyWorldUserOrderStatus,
} from "./notificationService";
import {
  evaluateReferralRewards,
  findReferrerByCode,
  markReferralMilestonesAnnounced,
} from "./referralService";

const ORDER_BACKFILL_STATE_KEY = "worldtmpesa_order_backfill_state";
const ORDER_BACKFILL_COOLDOWN_MS = 1000 * 60 * 15;

export function initializeOrders() {
  const storedOrders = readStorage(STORAGE_KEYS.orders, null);

  if (!storedOrders) {
    writeStorage(STORAGE_KEYS.orders, []);
    return;
  }

  const orders = Array.isArray(storedOrders) ? storedOrders : [];
  const migratedOrders = orders.map((order) =>
    order.asset === "USDT" ? { ...order, asset: "USDC" } : order,
  );

  if (JSON.stringify(orders) !== JSON.stringify(migratedOrders)) {
    writeStorage(STORAGE_KEYS.orders, migratedOrders);
  }
}

export function getAllOrders() {
  return readStorage(STORAGE_KEYS.orders, []);
}

function getOrderTime(order) {
  return new Date(order.updatedAt || order.createdAt || 0).getTime();
}

function mergeOrders(orders) {
  const byId = new Map();

  for (const order of orders.filter(Boolean)) {
    const current = byId.get(order.id);

    if (!current || getOrderTime(order) >= getOrderTime(current)) {
      byId.set(order.id, order);
    }
  }

  return Array.from(byId.values()).sort((first, second) => getOrderTime(second) - getOrderTime(first));
}

export function mergeAdminOrders(remoteOrders = []) {
  const merged = mergeOrders([...getAllOrders(), ...remoteOrders]);
  writeStorage(STORAGE_KEYS.orders, merged);
  return merged;
}

export async function fetchSharedAdminOrders() {
  const payload = await fetchAdminOrderQueue();

  if (!payload?.ok) {
    return {
      ...payload,
      orders: getAllOrders(),
    };
  }

  return {
    ...payload,
    orders: mergeAdminOrders(payload.orders || []),
  };
}

export async function syncOrderToAdminQueue(order, options = {}) {
  return syncAdminOrder(order, options);
}

export async function backfillExistingOrdersToAdminQueue() {
  const orders = getAllOrders();

  if (!orders.length) {
    return { ok: true, count: 0 };
  }

  const signature = orders
    .map((order) => `${order.id}:${order.updatedAt || order.createdAt || ""}:${order.status || ""}`)
    .sort()
    .join("|");
  const currentState = readStorage(ORDER_BACKFILL_STATE_KEY, {});
  const syncedRecently =
    currentState.signature === signature &&
    Date.now() - Number(currentState.syncedAt || 0) < ORDER_BACKFILL_COOLDOWN_MS;

  if (syncedRecently) {
    return { ok: true, count: orders.length, skipped: true };
  }

  // Only re-send orders that changed since the last successful backfill —
  // re-uploading the full history on every app open is what exhausted the
  // Blob store quota (the admin device holds every user's orders locally).
  const lastSyncedOrderTime = Number(currentState.lastSyncedOrderTime || 0);
  const pendingOrders = orders.filter((order) => getOrderTime(order) > lastSyncedOrderTime);

  if (!pendingOrders.length) {
    writeStorage(ORDER_BACKFILL_STATE_KEY, {
      ...currentState,
      signature,
      syncedAt: Date.now(),
    });
    return { ok: true, count: 0, skipped: true };
  }

  const result = await syncAdminOrders(pendingOrders, { notifyAdmin: false });
  writeStorage(ORDER_BACKFILL_STATE_KEY, {
    signature,
    syncedAt: Date.now(),
    lastSyncedOrderTime: Math.max(...pendingOrders.map(getOrderTime)),
  });
  return result;
}

export function getOrdersForCurrentUser() {
  const currentUser = getCurrentUser();
  const orders = getAllOrders();

  if (!currentUser) {
    return [];
  }

  if (currentUser.isAdmin) {
    return orders;
  }

  return orders.filter((order) => order.userId === currentUser.id);
}

// Build an in-memory draft order. Nothing is persisted, synced, or notified
// here — a draft only becomes a real order once the user completes payment
// (commitPaidOrder). If the user abandons the flow, the draft simply vanishes.
export function buildDraftOrder(payload) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error("You must be logged in to place an order.");
  }

  return {
    id: crypto.randomUUID(),
    userId: currentUser.id,
    userPhone: currentUser.phone,
    userMpesaPhoneNumber: payload.payoutPhoneNumber || currentUser.mpesaPhoneNumber || "",
    userWalletAddress: currentUser.walletAddress || "",
    userLabel: currentUser.username || currentUser.fullName || currentUser.phone,
    type: payload.type,
    asset: payload.asset,
    cryptoAmount: Number(payload.cryptoAmount),
    kesAmount: Number(payload.kesAmount),
    grossKesAmount: Number(payload.grossKesAmount || payload.kesAmount || 0),
    feeKesAmount: Number(payload.feeKesAmount || 0),
    feePerCoinKes: Number(payload.feePerCoinKes || 0),
    walletAddress: payload.walletAddress || "",
    destinationUsername: payload.destinationUsername || currentUser.username || "",
    payoutPhoneNumber: payload.payoutPhoneNumber || "",
    referredByCode: currentUser.referredByCode || "",
    humanVerificationStatus: payload.humanVerificationStatus || "",
    humanVerificationLevel: payload.humanVerificationLevel || "",
    paymentReference: payload.paymentReference || "",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

// Commit a completed order: the user has actually sent the crypto (sell) or
// paid via M-Pesa (buy). This is the ONLY point an order is stored locally,
// pushed to the shared admin queue, and notifies admin. Drafts that never get
// here are never saved anywhere.
export async function commitPaidOrder(draftOrder, changes = {}) {
  const committed = {
    ...draftOrder,
    ...changes,
    status: changes.status || "paid",
    createdAt: draftOrder.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const orders = getAllOrders();
  const exists = orders.some((order) => order.id === committed.id);
  writeStorage(
    STORAGE_KEYS.orders,
    exists
      ? orders.map((order) => (order.id === committed.id ? committed : order))
      : [committed, ...orders],
  );

  // Push to the shared admin queue (notifyAdmin:false — notifyAdminOrderCreated
  // below is the single admin notification path). Tolerant of a *transient*
  // failure (network drop, server hiccup) — the boot-time backfill re-syncs
  // those. NOT tolerant of a server-explicit rejection (409 = this payment
  // reference is already used on a different order; 403 = blocked) — those
  // will never succeed on retry, and silently swallowing one would show the
  // user a success receipt for an order the admin will never actually see.
  try {
    await syncOrderToAdminQueue(committed, { notifyAdmin: false });
  } catch (error) {
    if (error?.status === 409 || error?.status === 403) {
      throw error;
    }
    // Transient — saved locally, backfill retries on next app open.
  }
  void notifyAdminOrderCreated(committed).catch(() => null);
  void notifyWorldUserOrderCreated(committed).catch(() => null);
  return committed;
}

export function updateOrder(orderId, changes, fallbackOrder = null, options = {}) {
  const shouldSync = options.sync !== false;
  const orders = getAllOrders();
  const previousOrder = orders.find((order) => order.id === orderId);
  const updatedOrderBase = previousOrder || fallbackOrder;
  const updatedOrder = updatedOrderBase
    ? { ...updatedOrderBase, ...changes, updatedAt: new Date().toISOString() }
    : null;
  const updatedOrders = previousOrder
    ? orders.map((order) => (order.id === orderId ? updatedOrder : order))
    : updatedOrder
      ? [updatedOrder, ...orders]
      : orders;

  writeStorage(STORAGE_KEYS.orders, updatedOrders);
  const nextOrder = updatedOrders.find((order) => order.id === orderId);

  if (
    nextOrder &&
    changes.status &&
    previousOrder?.status !== changes.status &&
    ["paid", "completed", "rejected"].includes(changes.status)
  ) {
    void notifyWorldUserOrderStatus(nextOrder, changes.status).catch(() => null);
  }

  if (nextOrder && shouldSync) {
    void syncOrderToAdminQueue(nextOrder).catch(() => null);
  }

  if (
    nextOrder &&
    changes.status === "completed" &&
    previousOrder?.status !== "completed"
  ) {
    const resolvedReferrer = nextOrder.referredByCode
      ? findReferrerByCode(nextOrder.referredByCode)
      : null;

    if (resolvedReferrer) {
      const rewardState = evaluateReferralRewards(resolvedReferrer);

      if (rewardState.unannouncedMilestones.length) {
        void notifyAdminReferralEvent({
          eventType: "milestone",
          referralCode: nextOrder.referredByCode,
          referrerUsername: resolvedReferrer.username || "",
          referrerLabel: resolvedReferrer.fullName || resolvedReferrer.phone || "Tcash referrer",
          referrerMpesaPhoneNumber: resolvedReferrer.mpesaPhoneNumber || "",
          referredUsername: nextOrder.destinationUsername || "",
          referredLabel: nextOrder.userLabel || "Activated user",
          referredWalletAddress: nextOrder.userWalletAddress || "",
          referredUsers: rewardState.summary.referredUsers,
          activatedUsers: rewardState.summary.activatedUsers,
          eligibleRewardKes: rewardState.unannouncedMilestones.reduce(
            (sum, milestone) => sum + Number(milestone.rewardKes || 0),
            0,
          ),
          createdAt: new Date().toISOString(),
        }).catch(() => null);
        markReferralMilestonesAnnounced(
          nextOrder.referredByCode,
          rewardState.unannouncedMilestones.map((milestone) => milestone.users),
        );
      }
    }
  }

  return nextOrder;
}
