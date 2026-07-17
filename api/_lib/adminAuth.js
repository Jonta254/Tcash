import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

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
  const expected = sign(payload);

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
