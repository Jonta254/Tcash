import { randomUUID } from "node:crypto";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { parseCookies } from "./_lib/cookies.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { logAdminAction, logEvent, logSecurityEvent } from "./_lib/log.js";
import { getRequestAdminWallet, requestIsRecognizedAdmin } from "./_lib/adminAuth.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./_lib/userSession.js";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const CLAIMS_KEY = "tmpesa:referral_claims";
const MAX_STRING_FIELD_LENGTH = 256;
const CLAIM_STATUSES = new Set(["pending", "approved", "paid"]);

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
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Tcash referral store command ${command[0]} failed.`);
  }

  return payload.result;
}

function requestUserWallet(req) {
  const cookies = parseCookies(req);
  const session = verifyUserSessionToken(cookies[USER_SESSION_COOKIE]);
  return session.valid ? session.walletAddress : null;
}

export function isBoundedString(value, maxLength = MAX_STRING_FIELD_LENGTH) {
  return typeof value !== "string" || value.length <= maxLength;
}

export function isClaimRecord(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 90 &&
    isBoundedString(value.referralCode) &&
    isBoundedString(value.referrerUsername) &&
    isBoundedString(value.referrerLabel) &&
    isBoundedString(value.referrerMpesaPhoneNumber) &&
    isBoundedString(value.referrerWalletAddress) &&
    Number.isFinite(Number(value.milestoneUsers)) &&
    Number.isFinite(Number(value.rewardKes)) &&
    CLAIM_STATUSES.has(value.status)
  );
}

export function normalizeWallet(address) {
  return String(address || "").trim().toLowerCase();
}

async function readAllClaims() {
  const values = await redisCommand(["HVALS", CLAIMS_KEY]);
  return (values || [])
    .map((value) => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function sortByCreatedDesc(claims) {
  return claims
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST"])) {
    return;
  }

  if (!redisConfigured()) {
    sendJson(res, 200, {
      ok: false,
      pendingSetup: true,
      claims: [],
      message: "Connect Upstash Redis so Tcash can share referral claims across devices.",
    });
    return;
  }

  if (req.method === "GET") {
    // Claims carry a payout phone number and are inherently the
    // operator's payout queue — admin-only, same posture as orders.
    if (!requestIsRecognizedAdmin(req)) {
      logSecurityEvent("referral_claims.unauthorized_read", {});
      sendJson(res, 401, { ok: false, claims: [], error: "Sign in as an operator to view referral claims." });
      return;
    }

    try {
      const claims = await readAllClaims();
      sendJson(res, 200, { ok: true, claims: sortByCreatedDesc(claims) });
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        claims: [],
        error: error instanceof Error ? error.message : "Unable to load referral claims.",
      });
    }
    return;
  }

  const requestId = randomUUID();
  const isAdmin = requestIsRecognizedAdmin(req);
  const adminWallet = isAdmin ? getRequestAdminWallet(req) : null;
  const callerWallet = isAdmin ? null : requestUserWallet(req);

  if (!isAdmin && !callerWallet) {
    logSecurityEvent("referral_claims.unauthorized_write", {});
    sendJson(res, 401, { ok: false, error: "Sign in to submit a referral claim." });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const claim = payload.claim;

    if (!isClaimRecord(claim)) {
      sendJson(res, 400, { ok: false, error: "Send a valid referral claim." });
      return;
    }

    const existingRaw = await redisCommand(["HGET", CLAIMS_KEY, claim.id]);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;

    if (existing) {
      // An existing claim can only have its status changed, and only
      // by a recognized operator — this is the actual money-moving
      // action (approve / mark paid).
      if (!isAdmin) {
        logSecurityEvent("referral_claims.unauthorized_update", { claimId: claim.id });
        sendJson(res, 403, { ok: false, error: "Only a signed-in Tcash operator can update a referral claim." });
        return;
      }

      if (!isTrustedOrigin(req)) {
        logSecurityEvent("referral_claims.blocked_origin", { claimId: claim.id });
        sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
        return;
      }

      const updated = { ...existing, ...claim, updatedAt: new Date().toISOString() };
      await redisCommand(["HSET", CLAIMS_KEY, claim.id, JSON.stringify(updated)]);

      logAdminAction({
        requestId,
        administrator: adminWallet,
        action: `referral_claim.${updated.status}`,
        target: claim.id,
        result: "success",
      });

      sendJson(res, 200, { ok: true, claim: updated });
      return;
    }

    // A brand-new claim — must belong to the caller's own verified
    // wallet, the same ownership rule api/orders.js applies. An admin
    // creating a claim directly is not a real product path but is
    // allowed for backfill/support parity with how orders work.
    if (!isAdmin && normalizeWallet(claim.referrerWalletAddress) !== normalizeWallet(callerWallet)) {
      logSecurityEvent("referral_claims.ownership_mismatch", { claimId: claim.id, callerWallet });
      sendJson(res, 403, { ok: false, error: "This referral claim does not belong to your wallet." });
      return;
    }

    await redisCommand(["HSET", CLAIMS_KEY, claim.id, JSON.stringify(claim)]);
    logEvent("referral_claim.created", { claimId: claim.id, referralCode: claim.referralCode });

    sendJson(res, 200, { ok: true, claim });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to save referral claim.",
    });
  }
}
