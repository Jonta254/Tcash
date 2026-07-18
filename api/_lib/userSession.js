import { createHmac, timingSafeEqual } from "node:crypto";

// A 30-day rolling session. The app currently keeps a user "logged in"
// indefinitely in localStorage with no re-auth prompt, so a short session
// would force unexpected re-authentication (a wallet-approval prompt) far
// more often than the product has ever asked for — this matches existing
// behavior rather than inventing a new one.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const USER_SESSION_COOKIE = "tmpesa_user_session";
export const USER_SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SIWE_NONCE_SECRET || process.env.DEV_PORTAL_API_KEY;
}

function sign(value) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function timingSafeStringEqual(a, b) {
  const bufferA = Buffer.from(String(a || ""));
  const bufferB = Buffer.from(String(b || ""));

  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

function normalizeWallet(address) {
  return String(address || "").trim().toLowerCase();
}

/**
 * Issued once, right after api/complete-siwe.js verifies a real SIWE
 * signature — this token is the server's own record of "this request is
 * genuinely coming from the holder of this wallet," not a claim the
 * client can manufacture. Every other endpoint that needs to know who's
 * calling reads *this*, never a client-supplied userId/walletAddress
 * field in a request body.
 */
export function createUserSessionToken(walletAddress) {
  const wallet = normalizeWallet(walletAddress);

  if (!wallet) {
    throw new Error("Cannot issue a session for an empty wallet address.");
  }

  const issuedAt = Date.now();
  const walletB64 = Buffer.from(wallet).toString("base64url");
  const payload = `user.${walletB64}.${issuedAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

/**
 * @returns {{ valid: boolean, walletAddress: string|null }}
 */
export function verifyUserSessionToken(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, walletAddress: null };
  }

  const parts = token.split(".");
  if (parts.length !== 4) {
    return { valid: false, walletAddress: null };
  }

  const [prefix, walletB64, issuedAtRaw, signature] = parts;

  if (prefix !== "user") {
    return { valid: false, walletAddress: null };
  }

  const payload = `${prefix}.${walletB64}.${issuedAtRaw}`;
  let expected;
  try {
    // A missing/misconfigured signing secret must fail closed (treat the
    // token as invalid), not crash the request with a 500 that leaks
    // "the server is misconfigured" as an unhandled exception.
    expected = sign(payload);
  } catch {
    return { valid: false, walletAddress: null };
  }

  if (!timingSafeStringEqual(signature, expected)) {
    return { valid: false, walletAddress: null };
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return { valid: false, walletAddress: null };
  }

  const ageSeconds = (Date.now() - issuedAt) / 1000;
  if (ageSeconds < 0 || ageSeconds > SESSION_MAX_AGE_SECONDS) {
    return { valid: false, walletAddress: null };
  }

  let walletAddress;
  try {
    walletAddress = Buffer.from(walletB64, "base64url").toString("utf8");
  } catch {
    return { valid: false, walletAddress: null };
  }

  return { valid: true, walletAddress };
}
