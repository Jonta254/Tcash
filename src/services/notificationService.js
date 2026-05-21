import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";

function buildAdminAlert(type, title, message, payload = {}) {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    payload,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

function persistAdminAlert(alert) {
  const alerts = readStorage(STORAGE_KEYS.adminAlerts, []);
  writeStorage(STORAGE_KEYS.adminAlerts, [alert, ...alerts].slice(0, 50));
  return alert;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return response.json().catch(() => ({}));
}

function getOrderUserLabel(order) {
  return order?.destinationUsername
    ? `@${order.destinationUsername}`
    : order?.userLabel || "TMpesa user";
}

async function notifyAdminWorldOrderCreated(order) {
  const walletAddress = APP_CONFIG.admin.worldWalletAddress;

  if (!walletAddress) {
    return { sent: false, skipped: true, reason: "No admin World wallet configured." };
  }

  return postJson("/api/send-world-notification", {
    walletAddress,
    title: "New TMpesa order",
    message: `${getOrderUserLabel(order)} placed a ${order.type} order for ${order.cryptoAmount} ${order.asset}.`,
    miniAppPath: "/tmpesa-admin",
  });
}

export function getAdminAlerts() {
  return readStorage(STORAGE_KEYS.adminAlerts, []);
}

export function markAdminAlertRead(alertId) {
  const alerts = getAdminAlerts();
  const nextAlerts = alerts.map((alert) =>
    alert.id === alertId ? { ...alert, read: true, readAt: new Date().toISOString() } : alert,
  );
  writeStorage(STORAGE_KEYS.adminAlerts, nextAlerts);
  return nextAlerts;
}

export function clearAdminAlerts() {
  writeStorage(STORAGE_KEYS.adminAlerts, []);
}

export async function notifyAdminOrderCreated(order) {
  const title =
    order.type === "sell" ? "New sell order received" : "New buy order received";
  const message =
    order.type === "sell"
      ? `${getOrderUserLabel(order)} wants to sell ${order.cryptoAmount} ${order.asset} for ${Number(order.kesAmount || 0).toLocaleString()} KES.`
      : `${getOrderUserLabel(order)} wants to buy ${order.cryptoAmount} ${order.asset} for ${Number(order.kesAmount || 0).toLocaleString()} KES.`;

  const alert = persistAdminAlert(
    buildAdminAlert("order-created", title, message, {
      orderId: order.id,
      orderType: order.type,
      asset: order.asset,
      kesAmount: order.kesAmount,
      cryptoAmount: order.cryptoAmount,
      username: order.destinationUsername || "",
      payoutPhoneNumber: order.payoutPhoneNumber || order.userMpesaPhoneNumber || "",
    }),
  );

  const results = await Promise.allSettled([
    postJson("/api/notify-order", { order }),
    notifyAdminWorldOrderCreated(order),
  ]);

  return {
    notified: true,
    recorded: true,
    alert,
    emailResult: results[0].status === "fulfilled" ? results[0].value : { notified: false },
    worldResult: results[1].status === "fulfilled" ? results[1].value : { sent: false },
  };
}

export async function notifyWorldUserOrderCreated(order) {
  if (!order?.userWalletAddress) {
    return { sent: false, skipped: true, reason: "No World wallet address on order." };
  }

  const username = getOrderUserLabel(order);

  try {
    return await postJson("/api/send-world-notification", {
      walletAddress: order.userWalletAddress,
      title: "TMpesa order received",
      message:
        order.type === "sell"
          ? `Hello ${username}, your ${order.asset} sell order is pending review. Open TMpesa to track payout progress.`
          : `Hello ${username}, your ${order.asset} buy order is pending review. Open TMpesa to track payment progress.`,
      miniAppPath: "/orders",
    });
  } catch {
    return { sent: false, error: "World notification request failed." };
  }
}

export async function notifyWorldUserOrderStatus(order, status) {
  if (!order?.userWalletAddress) {
    return { sent: false, skipped: true, reason: "No World wallet address on order." };
  }

  const username = getOrderUserLabel(order);
  const copyByStatus = {
    paid: {
      title: "TMpesa order under review",
      message:
        order.type === "sell"
          ? `Hello ${username}, your sell order is now under manual review. TMpesa will notify you when payout is completed.`
          : `Hello ${username}, your buy payment is now under manual review. TMpesa will notify you when crypto is sent.`,
    },
    completed: {
      title: "TMpesa order completed",
      message:
        order.type === "sell"
          ? `Hello ${username}, your sell order is completed and KES payout has been processed.`
          : `Hello ${username}, your buy order is completed and crypto has been released to your wallet.`,
    },
    rejected: {
      title: "TMpesa order update",
      message: `Hello ${username}, your order was marked as rejected. Open TMpesa support for the next step.`,
    },
  };

  const copy = copyByStatus[status];

  if (!copy) {
    return { sent: false, skipped: true, reason: "No notification copy for this status." };
  }

  try {
    return await postJson("/api/send-world-notification", {
      walletAddress: order.userWalletAddress,
      title: copy.title,
      message: copy.message,
      miniAppPath: "/orders",
    });
  } catch {
    return { sent: false, error: "World notification request failed." };
  }
}

export async function notifyAdminReferralEvent(payload) {
  const title =
    payload?.eventType === "claim" ? "Referral claim requested" : "Referral milestone reached";
  const message =
    payload?.eventType === "claim"
      ? `${payload.referrerUsername ? `@${payload.referrerUsername}` : payload.referrerLabel} requested KES ${payload.eligibleRewardKes} referral payout.`
      : `${payload.referrerUsername ? `@${payload.referrerUsername}` : payload.referrerLabel} reached ${payload.activatedUsers} activated referrals.`;

  persistAdminAlert(
    buildAdminAlert("referral", title, message, {
      referralCode: payload?.referralCode || "",
      referrerUsername: payload?.referrerUsername || "",
      referrerMpesaPhoneNumber: payload?.referrerMpesaPhoneNumber || "",
      eligibleRewardKes: payload?.eligibleRewardKes || 0,
      eventType: payload?.eventType || "milestone",
    }),
  );

  try {
    const response = await fetch("/api/notify-referral", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return response.json().catch(() => ({ notified: false }));
  } catch {
    return { notified: false, error: "Referral notification request failed." };
  }
}
