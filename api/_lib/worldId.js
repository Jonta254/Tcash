import { list, put } from "@vercel/blob";
import { signRequest } from "@worldcoin/idkit-core/signing";

// World ID 4.0 (RP-signatures) verification for high-value orders.
//
// The one action registered on the Developer Portal for this RP. Every
// signed request and every proof we accept is scoped to it — the World
// verify endpoint (below) is itself scoped to our rp_id, so a proof for
// any other action or app cannot satisfy this gate.
export const HIGH_VALUE_ACTION = "high-value-order-check";

// KES value at or above which a first-time high-value order requires a
// World ID proof-of-human. Mirrored on the client (appConfig
// tradeLimits.highValueKesThreshold) purely for UX; this server value is
// the one that actually gates order creation in api/orders.js.
export const HIGH_VALUE_KES_THRESHOLD = Number(
  process.env.WORLD_ID_HIGH_VALUE_KES || 10000,
);

const RP_ID = process.env.WORLD_ID_RP_ID || "rp_db305722e6cdf990";
const WORLD_VERIFY_URL = `https://developer.world.org/api/v4/verify/${RP_ID}`;
const WORLD_VERIFY_TIMEOUT_MS = 8000;

// Order store already standardises on Upstash Redis (preferred) with a
// Vercel Blob fallback — the World ID records use exactly the same two
// backends so nothing new has to be provisioned.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
// hash field `${action}:${nullifier}` -> the wallet that first claimed it.
const NULLIFIER_KEY = "tmpesa:worldid:nullifiers";
// hash field wallet -> JSON { nullifier, verifiedAt }.
const VERIFIED_KEY = "tmpesa:worldid:verified";
const BLOB_PREFIX = "tmpesa/worldid/";

function getSigningKey() {
  return process.env.WORLD_ID_RP_SIGNING_KEY || process.env.RP_SIGNING_KEY || "";
}

export function worldIdSigningConfigured() {
  return Boolean(getSigningKey());
}

function redisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

function storeConfigured() {
  return redisConfigured() || Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// The gate in api/orders.js only activates when this is true. Until the
// signing key and a store are both configured, high-value orders behave
// exactly as they did before this feature existed (no gate) — so setting
// the WORLD_ID_RP_SIGNING_KEY env var is the single switch that turns
// verification on in production, with no code change or redeploy risk to
// the existing order flow before then.
export function worldIdVerificationAvailable() {
  return worldIdSigningConfigured() && storeConfigured();
}

/**
 * Booleans only — never the key itself, and never enough to reconstruct it.
 * Exists so "verification is unavailable" can be diagnosed from outside
 * (via /api/health) without shell access to the deployment: it says which
 * half is missing, the signing key or the record store, instead of leaving
 * a single opaque `available: false`.
 */
export function worldIdConfigDiagnostics() {
  return {
    signingKey: worldIdSigningConfigured(),
    store: storeConfigured(),
    redis: redisConfigured(),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  };
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
    throw new Error(payload.error || `World ID store command ${command[0]} failed.`);
  }

  return payload.result;
}

function normalizeWallet(wallet) {
  return String(wallet || "").trim().toLowerCase();
}

function normalizeNullifier(nullifier) {
  return String(nullifier || "").trim().toLowerCase();
}

function nullifierField(nullifier) {
  return `${HIGH_VALUE_ACTION}:${normalizeNullifier(nullifier)}`;
}

function blobSafe(value) {
  return String(value || "").replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

/**
 * Sign a fresh RP request for the high-value action. A new nonce is minted
 * on every call and is short-lived (idkit-server default TTL), so a
 * captured proof cannot be replayed against a later request — the World
 * verify endpoint checks the signature and expiry.
 *
 * @returns RpContext shaped exactly as @worldcoin/idkit's widget expects:
 *   { rp_id, nonce, created_at, expires_at, signature }
 */
export function signHighValueRequest() {
  const signingKeyHex = getSigningKey();

  if (!signingKeyHex) {
    throw new Error("World ID signing key is not configured.");
  }

  const rpSig = signRequest({ signingKeyHex, action: HIGH_VALUE_ACTION });

  return {
    rp_id: RP_ID,
    nonce: rpSig.nonce,
    created_at: rpSig.createdAt,
    expires_at: rpSig.expiresAt,
    signature: rpSig.sig,
  };
}

/**
 * Forward the entire IDKit result to World's protocol verifier as-is. World
 * is the authority on proof validity (Groth16 proof, nonce/signature
 * freshness, action/app binding via our rp_id in the URL); this app never
 * re-implements that check.
 */
export async function verifyProofWithWorld(idkitResult) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), WORLD_VERIFY_TIMEOUT_MS) : null;

  try {
    const response = await fetch(WORLD_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(idkitResult),
      signal: controller?.signal,
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Bind an RP-scoped nullifier to the first wallet that presents it.
 *
 * RP-scoped nullifiers are deterministic per (person, action), so the same
 * human always yields the same nullifier. Claiming it for a wallet means:
 *   - a different wallet later presenting the same nullifier is a sybil /
 *     replay attempt and is rejected (conflict);
 *   - the same wallet re-presenting it is idempotent (a returning user).
 *
 * @returns {{ ok: boolean, conflict?: boolean, idempotent?: boolean }}
 */
export async function claimNullifierForWallet(nullifier, wallet) {
  const walletId = normalizeWallet(wallet);
  const field = nullifierField(nullifier);

  if (redisConfigured()) {
    const inserted = await redisCommand(["HSETNX", NULLIFIER_KEY, field, walletId]);

    if (inserted === 1) {
      return { ok: true };
    }

    const existing = normalizeWallet(await redisCommand(["HGET", NULLIFIER_KEY, field]));
    return existing === walletId ? { ok: true, idempotent: true } : { ok: false, conflict: true };
  }

  // Blob fallback: put with allowOverwrite:false is our closest primitive to
  // an atomic insert. On conflict we read the existing record to decide
  // idempotent-vs-sybil. (Production uses Redis, which is genuinely atomic.)
  const path = `${BLOB_PREFIX}nullifier-${blobSafe(normalizeNullifier(nullifier))}.json`;
  const record = JSON.stringify({ wallet: walletId, action: HIGH_VALUE_ACTION });

  try {
    await put(path, record, {
      access: "public",
      allowOverwrite: false,
      contentType: "application/json",
    });
    return { ok: true };
  } catch {
    try {
      const found = await list({ prefix: path, limit: 1 });
      const blob = found.blobs[0];

      if (blob) {
        const existing = await fetch(blob.url, { cache: "no-store" }).then((r) => r.json());
        if (normalizeWallet(existing?.wallet) === walletId) {
          return { ok: true, idempotent: true };
        }
      }
    } catch {
      // fall through to conflict
    }
    return { ok: false, conflict: true };
  }
}

export async function markWalletVerified(wallet, nullifier) {
  const walletId = normalizeWallet(wallet);
  const record = JSON.stringify({
    nullifier: normalizeNullifier(nullifier),
    verifiedAt: new Date().toISOString(),
  });

  if (redisConfigured()) {
    await redisCommand(["HSET", VERIFIED_KEY, walletId, record]);
    return;
  }

  await put(`${BLOB_PREFIX}verified-${blobSafe(walletId)}.json`, record, {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function isWalletVerified(wallet) {
  const walletId = normalizeWallet(wallet);

  if (!walletId) {
    return false;
  }

  if (redisConfigured()) {
    const value = await redisCommand(["HGET", VERIFIED_KEY, walletId]);
    return Boolean(value);
  }

  try {
    const found = await list({ prefix: `${BLOB_PREFIX}verified-${blobSafe(walletId)}.json`, limit: 1 });
    return found.blobs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validate the coarse shape of an IDKit v4 uniqueness result before we
 * spend a network round-trip forwarding it to World. Cryptographic
 * validity is World's job; this only rejects obviously-wrong payloads.
 */
export function isPlausibleHighValueProof(result) {
  return Boolean(
    result &&
      typeof result === "object" &&
      result.protocol_version === "4.0" &&
      typeof result.action === "string" &&
      result.action.length > 0 &&
      Array.isArray(result.responses) &&
      result.responses.length > 0 &&
      result.responses.some((response) => response && typeof response.nullifier === "string"),
  );
}

export function extractNullifier(result) {
  return result.responses.map((response) => response?.nullifier).find(Boolean) || null;
}
