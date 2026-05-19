import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";
import { getAllOrders } from "./orderService";
import { getCurrentUser, getUsers } from "./authService";

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

function getUnannouncedMilestones(referralCode, activatedUsers) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const milestoneState = stats[`milestones:${normalizeCode(referralCode)}`] || { announcedMilestones: [] };
  const announcedMilestones = new Set(milestoneState.announcedMilestones || []);

  return getEligibleMilestones(activatedUsers).filter(
    (milestone) => !announcedMilestones.has(milestone.users),
  );
}

function getReferralClaims() {
  return readStorage(STORAGE_KEYS.referralClaims, []);
}

function getClaimsForReferralCode(referralCode) {
  const normalizedCode = normalizeCode(referralCode);
  return getReferralClaims().filter((claim) => normalizeCode(claim.referralCode) === normalizedCode);
}

function getOpenClaimMilestones(referralCode) {
  const claims = getClaimsForReferralCode(referralCode);
  const blockedStatuses = new Set(["pending", "approved", "paid"]);
  return new Set(
    claims
      .filter((claim) => blockedStatuses.has(claim.status))
      .map((claim) => claim.milestoneUsers),
  );
}

export function getReferralSummary(user) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const userKey = user?.id || "guest";
  const userStats = stats[userKey] || {};
  const code = getReferralCode(user);
  const referredUsers = getReferredUsers(code);
  const tradingSummary = getReferralTradingSummary(referredUsers);
  const claims = getClaimsForReferralCode(code);
  const openClaimMilestones = getOpenClaimMilestones(code);
  const claimableMilestones = getEligibleMilestones(tradingSummary.activatedUsers).filter(
    (milestone) => !openClaimMilestones.has(milestone.users),
  );
  const paidRewardsKes = claims
    .filter((claim) => claim.status === "paid")
    .reduce((sum, claim) => sum + Number(claim.rewardKes || 0), 0);

  return {
    code,
    shareCount: userStats.shareCount || 0,
    lastSharedAt: userStats.lastSharedAt || null,
    appLink: `https://world.org/mini-app?app_id=${encodeURIComponent(APP_CONFIG.worldAppId)}&path=${encodeURIComponent(getInvitePath(code))}`,
    referredUsers: referredUsers.length,
    activatedUsers: tradingSummary.activatedUsers,
    totalReferralOrders: tradingSummary.totalOrders,
    lifetimeRewardsKes: paidRewardsKes,
    unlockedRewardsKes: tradingSummary.lifetimeRewardsKes,
    rewardMilestones: getRewardMilestones(),
    pendingMilestones: claimableMilestones,
    claims,
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
  const unannouncedMilestones = getUnannouncedMilestones(summary.code, summary.activatedUsers);

  return {
    summary,
    pendingMilestones,
    unannouncedMilestones,
    eligibleRewardKes: pendingMilestones.reduce(
      (total, milestone) => total + Number(milestone.rewardKes || 0),
      0,
    ),
  };
}

export function markReferralMilestonesAnnounced(referralCode, milestones = []) {
  const stats = readStorage(STORAGE_KEYS.referralStats, {});
  const normalizedCode = normalizeCode(referralCode);
  const key = `milestones:${normalizedCode}`;
  const current = stats[key] || { announcedMilestones: [] };
  const mergedAnnounced = Array.from(new Set([...(current.announcedMilestones || []), ...milestones]));

  writeStorage(STORAGE_KEYS.referralStats, {
    ...stats,
    [key]: {
      ...current,
      announcedMilestones: mergedAnnounced,
      updatedAt: new Date().toISOString(),
    },
  });
}

export function createReferralClaim(user = getCurrentUser(), milestoneUsers) {
  if (!user) {
    throw new Error("You must be logged in to claim referral rewards.");
  }

  const summary = getReferralSummary(user);
  const milestone = summary.pendingMilestones.find((entry) => entry.users === milestoneUsers);

  if (!milestone) {
    throw new Error("This referral reward is not available to claim yet.");
  }

  if (!user.mpesaPhoneNumber?.trim()) {
    throw new Error("Add your M-Pesa payout number before claiming referral rewards.");
  }

  const claims = getReferralClaims();
  const claim = {
    id: crypto.randomUUID(),
    userId: user.id,
    referralCode: summary.code,
    referrerUsername: user.username || "",
    referrerLabel: user.fullName || user.phone || "TMpesa referrer",
    referrerMpesaPhoneNumber: user.mpesaPhoneNumber,
    milestoneUsers: milestone.users,
    rewardKes: milestone.rewardKes,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.referralClaims, [claim, ...claims]);
  return claim;
}

export function updateReferralClaim(claimId, changes) {
  const claims = getReferralClaims();
  const updatedClaims = claims.map((claim) =>
    claim.id === claimId ? { ...claim, ...changes, updatedAt: new Date().toISOString() } : claim,
  );

  writeStorage(STORAGE_KEYS.referralClaims, updatedClaims);
  return updatedClaims.find((claim) => claim.id === claimId) || null;
}

export function getAllReferralClaims() {
  return getReferralClaims();
}
