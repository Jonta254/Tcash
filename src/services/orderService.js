import { STORAGE_KEYS } from "../config/appConfig";
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

export function createOrder(payload) {
  const orders = getAllOrders();
  const currentUser = getCurrentUser();

  if (!currentUser) {
    throw new Error("You must be logged in to place an order.");
  }

  const order = {
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

  writeStorage(STORAGE_KEYS.orders, [order, ...orders]);
  void notifyAdminOrderCreated(order).catch(() => null);
  void notifyWorldUserOrderCreated(order).catch(() => null);
  return order;
}

export function updateOrder(orderId, changes) {
  const orders = getAllOrders();
  const previousOrder = orders.find((order) => order.id === orderId);
  const updatedOrders = orders.map((order) =>
    order.id === orderId ? { ...order, ...changes, updatedAt: new Date().toISOString() } : order,
  );

  writeStorage(STORAGE_KEYS.orders, updatedOrders);
  const updatedOrder = updatedOrders.find((order) => order.id === orderId);

  if (
    updatedOrder &&
    changes.status &&
    previousOrder?.status !== changes.status &&
    ["paid", "completed", "rejected"].includes(changes.status)
  ) {
    void notifyWorldUserOrderStatus(updatedOrder, changes.status).catch(() => null);
  }

  if (
    updatedOrder &&
    changes.status === "completed" &&
    previousOrder?.status !== "completed"
  ) {
    const resolvedReferrer = updatedOrder.referredByCode
      ? findReferrerByCode(updatedOrder.referredByCode)
      : null;

    if (resolvedReferrer) {
      const rewardState = evaluateReferralRewards(resolvedReferrer);

      if (rewardState.unannouncedMilestones.length) {
        void notifyAdminReferralEvent({
          eventType: "milestone",
          referralCode: updatedOrder.referredByCode,
          referrerUsername: resolvedReferrer.username || "",
          referrerLabel: resolvedReferrer.fullName || resolvedReferrer.phone || "TMpesa referrer",
          referrerMpesaPhoneNumber: resolvedReferrer.mpesaPhoneNumber || "",
          referredUsername: updatedOrder.destinationUsername || "",
          referredLabel: updatedOrder.userLabel || "Activated user",
          referredWalletAddress: updatedOrder.userWalletAddress || "",
          referredUsers: rewardState.summary.referredUsers,
          activatedUsers: rewardState.summary.activatedUsers,
          eligibleRewardKes: rewardState.unannouncedMilestones.reduce(
            (sum, milestone) => sum + Number(milestone.rewardKes || 0),
            0,
          ),
          createdAt: new Date().toISOString(),
        }).catch(() => null);
        markReferralMilestonesAnnounced(
          updatedOrder.referredByCode,
          rewardState.unannouncedMilestones.map((milestone) => milestone.users),
        );
      }
    }
  }

  return updatedOrder;
}
