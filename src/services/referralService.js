import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";
import { getAllOrders } from "./orderService";
import { getUsers } from "./authService";

function normalizeCode(value) {
  return String(value || "").replace(/^@/, "").trim().toUpperCase();
}

export function getReferralCode(user) {
  const username = normalizeCode(user?.username);

  if (username) {
    return `TMP-${username}`;
  }

  const walletSuffix = String(user?.walletAddress || "").slice(-6).toUpperCase();
  return `TMP-${walletSuffix || "WORLD"}`;
}

function getInvitePath(code) {
  return `/login?ref=${encodeURIComponent(code)}`;
}

function getReferredUsers(referralCode) {
  const normalizedCode = normalizeCode(referralCode);
  return getUsers().filter((user) => normalizeCode(user?.referredByCode) === normalizedCode);
}

function getReferralTradingSummary(referredUsers) {
  const referredUserIds = new Set(referredUsers.map((user) => user.id));
  const orders = getAllOrders().filter((order) => referredUserIds.has(order.userId));
  const activatedUsers = new Set(
    orders.filter((order) => order.status === "completed").map((order) => order.userId),
  );

  return {
    totalOrders: orders.length,
    activatedUsers: activatedUsers.size,
    lifetimeRewardsKes: activatedUsers.size * APP_CONFIG.defaultSettings.referralRewardKes,
  };
}

export function getReferralSummary(user) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const userKey = user?.id || "guest";
  const userStats = stats[userKey] || {};
  const code = getReferralCode(user);
  const referredUsers = getReferredUsers(code);
  const tradingSummary = getReferralTradingSummary(referredUsers);

  return {
    code,
    shareCount: userStats.shareCount || 0,
    lastSharedAt: userStats.lastSharedAt || null,
    appLink: `https://world.org/mini-app?app_id=${encodeURIComponent(APP_CONFIG.worldAppId)}&path=${encodeURIComponent(getInvitePath(code))}`,
    referredUsers: referredUsers.length,
    activatedUsers: tradingSummary.activatedUsers,
    totalReferralOrders: tradingSummary.totalOrders,
    lifetimeRewardsKes: tradingSummary.lifetimeRewardsKes,
    rewardPerActivatedUserKes: APP_CONFIG.defaultSettings.referralRewardKes,
  };
}

export function markReferralShared(user) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const userKey = user?.id || "guest";
  const current = stats[userKey] || {};
  const nextStats = {
    ...stats,
    [userKey]: {
      shareCount: (current.shareCount || 0) + 1,
      lastSharedAt: new Date().toISOString(),
    },
  };

  writeStorage(STORAGE_KEYS.referralStats, nextStats);
  return getReferralSummary(user);
}
