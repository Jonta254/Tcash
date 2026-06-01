import { createHmac, timingSafeEqual } from "node:crypto";

const WORLD_APP_ID = "app_02bd6decc052cfd1dfa2948744af6c6f";

function getNonceSecret() {
  return process.env.SIWE_NONCE_SECRET || process.env.DEV_PORTAL_API_KEY || WORLD_APP_ID;
}

export function createServerNonce(length = 24) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function signNonce(nonce) {
  return createHmac("sha256", getNonceSecret()).update(nonce).digest("base64url");
}

export function createSignedServerNonce(length = 24) {
  const nonce = createServerNonce(length);
  return {
    nonce,
    nonceSignature: signNonce(nonce),
  };
}

export function isValidSignedServerNonce(nonce, signature) {
  if (!nonce || !signature) {
    return false;
  }

  const expected = signNonce(nonce);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
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
