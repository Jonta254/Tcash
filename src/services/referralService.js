import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";

function getReferralCode(user) {
  const username = String(user?.username || "").replace(/^@/, "").trim().toUpperCase();

  if (username) {
    return `TMP-${username}`;
  }

  const walletSuffix = String(user?.walletAddress || "").slice(-6).toUpperCase();
  return `TMP-${walletSuffix || "WORLD"}`;
}

export function getReferralSummary(user) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const userKey = user?.id || "guest";
  const userStats = stats[userKey] || {};

  return {
    code: getReferralCode(user),
    shareCount: userStats.shareCount || 0,
    lastSharedAt: userStats.lastSharedAt || null,
    appLink: `https://world.org/mini-app?app_id=${encodeURIComponent(APP_CONFIG.worldAppId)}&path=${encodeURIComponent("/login")}`,
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
