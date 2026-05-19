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

export function findReferrerByCode(referralCode) {
  const normalizedCode = normalizeCode(referralCode);
  return (
    getUsers().find((user) => normalizeCode(getReferralCode(user)) === normalizedCode) || null
  );
}

function getReferralTradingSummary(referredUsers) {
  const referredUserIds = new Set(referredUsers.map((user) => user.id));
  const orders = getAllOrders().filter((order) => referredUserIds.has(order.userId));
  const activatedUsers = new Set(
    orders.filter((order) => order.status === "completed").map((order) => order.userId),
  );
  const achievedRewardsKes = getRewardMilestones()
    .filter((milestone) => activatedUsers.size >= milestone.users)
    .reduce((total, milestone) => total + Number(milestone.rewardKes || 0), 0);

  return {
    totalOrders: orders.length,
    activatedUsers: activatedUsers.size,
    lifetimeRewardsKes: achievedRewardsKes,
  };
}

function getRewardMilestones() {
  return [...(APP_CONFIG.defaultSettings.referralMilestones || [])].sort((left, right) => left.users - right.users);
}

function getEligibleMilestones(activatedUsers) {
  return getRewardMilestones().filter((milestone) => activatedUsers >= milestone.users);
}

function getPendingMilestones(referralCode, activatedUsers) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const milestoneState = stats[`milestones:${normalizeCode(referralCode)}`] || { claimedRewards: [] };
  const claimedRewards = new Set(milestoneState.claimedRewards || []);

  return getEligibleMilestones(activatedUsers).filter(
    (milestone) => !claimedRewards.has(milestone.users),
  );
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
    rewardMilestones: getRewardMilestones(),
    pendingMilestones: getPendingMilestones(code, tradingSummary.activatedUsers),
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

export function evaluateReferralRewards(user) {
  const summary = getReferralSummary(user);
  const pendingMilestones = summary.pendingMilestones || [];

  return {
    summary,
    pendingMilestones,
    eligibleRewardKes: pendingMilestones.reduce(
      (total, milestone) => total + Number(milestone.rewardKes || 0),
      0,
    ),
  };
}

export function markReferralMilestonesClaimed(referralCode, milestones = []) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const normalizedCode = normalizeCode(referralCode);
  const key = `milestones:${normalizedCode}`;
  const current = stats[key] || { claimedRewards: [] };
  const mergedClaimed = Array.from(new Set([...(current.claimedRewards || []), ...milestones]));

  writeStorage(STORAGE_KEYS.referralStats, {
    ...stats,
    [key]: {
      ...current,
      claimedRewards: mergedClaimed,
      updatedAt: new Date().toISOString(),
    },
  });
}
