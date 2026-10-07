import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const WORLD_APP_ID = "app_02bd6decc052cfd1dfa2948744af6c6f";

function getNonceSecret() {
  const secret = process.env.SIWE_NONCE_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.DEV_PORTAL_API_KEY;
  if (!secret) throw new Error("Wallet authentication is not configured.");
  return secret;
}

export function createServerNonce(length = 24) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function signNonce(nonce, issuedAt) {
  return createHmac("sha256", getNonceSecret()).update(`${nonce}:${issuedAt}`).digest("base64url");
}

export function createSignedServerNonce(length = 24) {
  const nonce = createServerNonce(length);
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    nonce,
    nonceSignature: `${issuedAt}.${signNonce(nonce, issuedAt)}`,
  };
}

export function isValidSignedServerNonce(nonce, signature) {
  if (typeof nonce !== "string" || !/^[a-zA-Z0-9]{8,128}$/.test(nonce) || typeof signature !== "string") {
    return false;
  }
  const [timestamp, mac, extra] = signature.split(".");
  const issuedAt = Number(timestamp);
  const age = Math.floor(Date.now() / 1000) - issuedAt;
  if (extra || !mac || !Number.isInteger(issuedAt) || age < 0 || age >= 600) return false;
  const expected = signNonce(nonce, issuedAt);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(mac);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

export async function claimSiweNonce(nonce) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Wallet authentication storage is unavailable. Try again later.");
  const key = `tmpesa:siwe-used:${createHash("sha256").update(nonce).digest("hex")}`;
  const response = await fetch(url, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["SET", key, "used", "NX", "EX", "600"]), signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error("Wallet authentication storage is unavailable. Try again later.");
  return payload.result === "OK";
}

export function getWorldPortalConfig() {
  return {
    appId: process.env.APP_ID || WORLD_APP_ID,
    apiKey: process.env.DEV_PORTAL_API_KEY || "",
  };
}

export function hasWorldPortalConfig() {
  const config = getWorldPortalConfig();
  return Boolean(config.appId && config.apiKey);
}
