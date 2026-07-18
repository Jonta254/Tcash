import { createHmac, timingSafeEqual } from "node:crypto";
import { parseCookies } from "./cookies.js";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "./userSession.js";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

// Same public, on-chain address already configured in src/config/appConfig.js
// (APP_CONFIG.admin.worldWalletAddress) and already duplicated once in
// api/orders.js as ADMIN_WORLD_WALLET — not a secret, just the operator's
// wallet. Kept here too rather than importing across the client/server
// boundary, matching the existing pattern in this codebase.
const ADMIN_WORLD_WALLET = "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc";

function getAdminSecret() {
  // Falls back to SIWE_NONCE_SECRET rather than a literal so there is no
  // string in source that, on its own, is a usable credential.
  return process.env.ADMIN_SESSION_SECRET || process.env.SIWE_NONCE_SECRET || process.env.DEV_PORTAL_API_KEY;
}

function timingSafeStringEqual(a, b) {
  const bufferA = Buffer.from(String(a || ""));
  const bufferB = Buffer.from(String(b || ""));

  if (bufferA.length !== bufferB.length) {
    // Still run a comparison of equal length to avoid a length-based
    // timing signal, then report the real (unequal) result.
    timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * The operator's own login identity — never the secret itself. The
 * password lives only in the ADMIN_PASSWORD Vercel environment variable,
 * never in source, never in the client bundle.
 */
export function isConfiguredAdminEnv() {
  return Boolean(process.env.ADMIN_PHONE && process.env.ADMIN_PASSWORD && getAdminSecret());
}

export function verifyAdminCredentials({ phone, password }) {
  if (!isConfiguredAdminEnv()) {
    return false;
  }

  const phoneMatches = timingSafeStringEqual(phone, process.env.ADMIN_PHONE);
  const passwordMatches = timingSafeStringEqual(password, process.env.ADMIN_PASSWORD);
  return phoneMatches && passwordMatches;
}

function sign(value) {
  return createHmac("sha256", getAdminSecret()).update(value).digest("base64url");
}

export function createAdminSessionToken() {
  const issuedAt = Date.now();
  const payload = `admin.${issuedAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [prefix, issuedAtRaw, signature] = parts;
  const payload = `${prefix}.${issuedAtRaw}`;
  let expected;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }

  if (!timingSafeStringEqual(signature, expected)) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return false;
  }

  const ageSeconds = (Date.now() - issuedAt) / 1000;
  return ageSeconds >= 0 && ageSeconds <= SESSION_MAX_AGE_SECONDS;
}

export const ADMIN_SESSION_COOKIE = "tmpesa_admin_session";
export const ADMIN_SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;

/**
 * There are two legitimate ways to become the TCash operator, and until
 * this fix only one of them was actually enforced server-side:
 *
 *   1. The phone/password fallback (api/admin-login.js) — sets
 *      ADMIN_SESSION_COOKIE. Meant for testing outside World App.
 *   2. Opening TCash inside World App as the configured admin wallet —
 *      this is the *real* operator path in production, and it only ever
 *      set a client-side `isAdmin: true` flag (src/services/authService.js
 *      isConfiguredWorldAdmin). The server-side gate added for
 *      completed/rejected order writes checked *only* path 1, which
 *      means the actual operator logging in the actual way the product
 *      expects would have been rejected by their own server.
 *
 * This checks both, from the server's own verified state in both cases —
 * never a client-supplied "trust me, I'm admin" flag.
 */
export function requestIsRecognizedAdmin(req) {
  const cookies = parseCookies(req);

  if (verifyAdminSessionToken(cookies[ADMIN_SESSION_COOKIE])) {
    return true;
  }

  const userSession = verifyUserSessionToken(cookies[USER_SESSION_COOKIE]);
  return Boolean(userSession.valid && userSession.walletAddress === ADMIN_WORLD_WALLET.toLowerCase());
}
