import { randomUUID } from "node:crypto";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { isTrustedOrigin } from "./_lib/csrf.js";
import { logAdminAction, logEvent, logSecurityEvent } from "./_lib/log.js";
import { getRequestAdminWallet, requestIsRecognizedAdmin } from "./_lib/adminAuth.js";

// Same Upstash Redis instance api/orders.js already uses — one small
// object under its own key, not a per-record hash, since there is
// exactly one live settings document, not a collection.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SETTINGS_KEY = "tmpesa:settings";

const MAX_STRING_FIELD_LENGTH = 256;
const MAX_FEE_VALUE = 100_000;
const KNOWN_STRING_FIELDS = [
  "sellWalletAddress",
  "mpesaPaybillNumber",
  "mpesaAccountNumber",
  "mpesaTillName",
  "supportEmail",
  "worldAppId",
];

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
    throw new Error(payload.error || `Tcash settings store command ${command[0]} failed.`);
  }

  return payload.result;
}

export function isBoundedString(value, maxLength = MAX_STRING_FIELD_LENGTH) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function isValidFee(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_FEE_VALUE;
}

// Only known fields are ever accepted — an admin payload can't smuggle
// arbitrary keys into the shared document that every user's client
// then trusts and renders.
export function sanitizeSettingsPayload(payload) {
  const sanitized = {};

  for (const field of KNOWN_STRING_FIELDS) {
    if (payload[field] === undefined) {
      continue;
    }

    const value = String(payload[field]).trim();

    if (!isBoundedString(value)) {
      throw new Error(`Enter a valid value for ${field}.`);
    }

    sanitized[field] = value;
  }

  if (payload.feeKesPerCoin && typeof payload.feeKesPerCoin === "object") {
    const feeKesPerCoin = {};

    for (const [asset, value] of Object.entries(payload.feeKesPerCoin)) {
      if (!isBoundedString(asset, 16) || !isValidFee(value)) {
        throw new Error(`Enter a valid fee for ${asset}.`);
      }

      feeKesPerCoin[asset] = Number(value);
    }

    if (Object.keys(feeKesPerCoin).length) {
      sanitized.feeKesPerCoin = feeKesPerCoin;
    }
  }

  return sanitized;
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET", "POST"])) {
    return;
  }

  if (!redisConfigured()) {
    sendJson(res, 200, {
      ok: false,
      pendingSetup: true,
      settings: null,
      message: "Connect Upstash Redis so Tcash can share operational settings across devices.",
    });
    return;
  }

  if (req.method === "GET") {
    // Public and unauthenticated on purpose — every user's Buy/Sell
    // quote depends on the live fee/rate/PayBill figures here, the
    // same way every user already reads the live market rate.
    try {
      const raw = await redisCommand(["GET", SETTINGS_KEY]);
      sendJson(res, 200, { ok: true, settings: raw ? JSON.parse(raw) : null });
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        settings: null,
        error: error instanceof Error ? error.message : "Unable to load settings.",
      });
    }
    return;
  }

  // Every write from here down is a privileged operator action.
  const requestId = randomUUID();
  const isAdmin = requestIsRecognizedAdmin(req);
  const adminWallet = isAdmin ? getRequestAdminWallet(req) : null;

  if (!isTrustedOrigin(req)) {
    logSecurityEvent("settings.blocked_origin", {});
    sendJson(res, 403, { ok: false, error: "Request origin could not be verified." });
    return;
  }

  if (!isAdmin) {
    logSecurityEvent("settings.unauthorized_attempt", {});
    sendJson(res, 403, { ok: false, error: "Only a signed-in Tcash operator can update settings." });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const sanitized = sanitizeSettingsPayload(payload);

    if (!Object.keys(sanitized).length) {
      sendJson(res, 400, { ok: false, error: "No valid settings fields were sent." });
      return;
    }

    const existingRaw = await redisCommand(["GET", SETTINGS_KEY]);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const next = {
      ...existing,
      ...sanitized,
      feeKesPerCoin: sanitized.feeKesPerCoin
        ? { ...(existing.feeKesPerCoin || {}), ...sanitized.feeKesPerCoin }
        : existing.feeKesPerCoin,
      updatedAt: new Date().toISOString(),
      updatedBy: adminWallet,
    };

    await redisCommand(["SET", SETTINGS_KEY, JSON.stringify(next)]);

    logAdminAction({
      requestId,
      administrator: adminWallet,
      action: "settings.update",
      target: "global",
      result: "success",
      fields: Object.keys(sanitized),
    });
    logEvent("settings.updated", { fields: Object.keys(sanitized) });

    sendJson(res, 200, { ok: true, settings: next });
  } catch (error) {
    logAdminAction({
      requestId,
      administrator: adminWallet,
      action: "settings.update",
      target: "global",
      result: "failed",
      reason: error instanceof Error ? error.message : "unknown",
    });
    sendJson(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to update settings.",
    });
  }
}
