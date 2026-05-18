import { STORAGE_KEYS } from "../config/appConfig";
import { getCurrentUser } from "./authService";
import { readStorage, writeStorage } from "./localStorage";
import { notifyAdminOrderCreated, notifyWorldUserOrderCreated } from "./notificationService";

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
    walletAddress: payload.walletAddress || "",
    destinationUsername: payload.destinationUsername || currentUser.username || "",
    payoutPhoneNumber: payload.payoutPhoneNumber || "",
    humanVerificationStatus: payload.humanVerificationStatus || "",
    humanVerificationLevel: payload.humanVerificationLevel || "",
    paymentReference: payload.paymentReference || "",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.orders, [order, ...orders]);
  notifyAdminOrderCreated(order);
  notifyWorldUserOrderCreated(order);
  return order;
}

export function updateOrder(orderId, changes) {
  const orders = getAllOrders();
  const updatedOrders = orders.map((order) =>
    order.id === orderId ? { ...order, ...changes, updatedAt: new Date().toISOString() } : order,
  );

  writeStorage(STORAGE_KEYS.orders, updatedOrders);
  return updatedOrders.find((order) => order.id === orderId);
}
