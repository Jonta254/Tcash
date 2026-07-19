import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { fetchSharedReferralClaims, syncReferralClaim } from "./backendService";
import { readStorage, writeStorage } from "./localStorage";
import { getAllOrders } from "./orderService";
import { getCurrentUser, getUsers } from "./authService";

function normalizeCode(value) {
  return String(value || "").replace(/^@/, "").trim().toUpperCase();
}

export function getReferralCode(user) {
  const username = normalizeCode(user?.username);

  if (username) {
    return `TC-${username}`;
  }

  const walletSuffix = String(user?.walletAddress || "").slice(-6).toUpperCase();
  return `TC-${walletSuffix || "WORLD"}`;
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
    appLink: `https://worldcoin.org/mini-app?app_id=${encodeURIComponent(APP_CONFIG.worldAppId)}&path=${encodeURIComponent(getInvitePath(code))}`,
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

// Local write happens first here (unlike settings) because this is a
// user-initiated action inside a flow that shouldn't feel network-
// gated, and losing a claim record to a transient failure is
// recoverable (the milestone stays pending-claimable, they can tap
// again) — the shared push is tolerated failing transiently, same
// posture as commitPaidOrder, but a server-explicit rejection (e.g.
// ownership mismatch) still surfaces rather than being swallowed.
export async function createReferralClaim(user = getCurrentUser(), milestoneUsers) {
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
    referrerLabel: user.fullName || user.phone || "Tcash referrer",
    referrerMpesaPhoneNumber: user.mpesaPhoneNumber,
    referrerWalletAddress: user.walletAddress || "",
    milestoneUsers: milestone.users,
    rewardKes: milestone.rewardKes,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.referralClaims, [claim, ...claims]);

  try {
    await syncReferralClaim(claim);
  } catch (error) {
    if (error?.status === 403 || error?.status === 401) {
      throw error;
    }
    // Transient — stays in local storage; the admin queue's own
    // periodic re-fetch and this project's existing backfill pattern
    // are what this project has for retrying, same as orders.
  }

  return claim;
}

// Admin-only status change (approve / mark paid) — the shared write
// happens *before* the local write, matching updateFeeKesPerCoin's
// reasoning: there's no optimistic-UI urgency here, and showing an
// admin a "paid" claim that didn't actually reach the shared queue
// would be the same silent-lie bug class this project has fixed twice
// already (order-status rollback, duplicate-payment-reference swallow).
export async function updateReferralClaim(claimId, changes) {
  const claims = getReferralClaims();
  const existing = claims.find((claim) => claim.id === claimId);

  if (!existing) {
    throw new Error("This referral claim could not be found.");
  }

  const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  const result = await syncReferralClaim(updated);

  if (!result?.ok) {
    throw new Error(result?.error || "Tcash could not update this referral claim.");
  }

  const updatedClaims = claims.map((claim) => (claim.id === claimId ? updated : claim));
  writeStorage(STORAGE_KEYS.referralClaims, updatedClaims);
  return updated;
}

export function getAllReferralClaims() {
  return getReferralClaims();
}

// Admin-only — pulls the real shared queue (every real user's claims,
// not just ones created in this browser) the same way
// fetchSharedAdminOrders does for orders.
export async function fetchSharedReferralClaimQueue() {
  const payload = await fetchSharedReferralClaims();

  if (!payload?.ok) {
    return { ...payload, claims: getReferralClaims() };
  }

  writeStorage(STORAGE_KEYS.referralClaims, payload.claims || []);
  return payload;
}
