import { MiniKit, getIsUserVerified } from "@worldcoin/minikit-js";
import { APP_CONFIG } from "../config/appConfig";
import {
  completeSiweVerification,
  confirmWorldPayment,
  createPaymentReference,
  requestServerNonce,
  verifyHighValueOrder,
} from "./backendService";

const NOTIFICATION_ALLOWED_STORAGE_KEY = "worldtmpesa_notification_allowed";
const TOKEN_DECIMALS = {
  WLD: 18,
  USDC: 6,
};

function toTokenUnits(amount, decimals) {
  const stringAmount = String(amount).trim();

  if (!/^\d+(\.\d+)?$/.test(stringAmount)) {
    throw new Error("Enter a valid amount before sending the payment.");
  }

  const [wholePart, fractionPart = ""] = stringAmount.split(".");
  const normalizedFraction = `${fractionPart}${"0".repeat(decimals)}`.slice(0, decimals);
  const units = `${wholePart}${normalizedFraction}`.replace(/^0+(?=\d)/, "");

  return units || "0";
}

async function runMiniKitCommand(commandName, payload) {
  const asyncCommandName = `${commandName}Async`;
  const command =
    MiniKit[asyncCommandName] || MiniKit.commandsAsync?.[commandName] || MiniKit[commandName];

  if (!command) {
    throw new Error(`World App command ${commandName} is not available in this MiniKit version.`);
  }

  const result = await command.call(MiniKit, payload);
  const data = result?.data || result?.finalPayload || result;

  if (data?.status === "error") {
    throw new Error(data?.message || `World App ${commandName} command was cancelled.`);
  }

  if (result?.executedWith === "fallback") {
    throw new Error(`Complete ${commandName} inside World App.`);
  }

  return { result, data };
}

function permissionGranted(data, targetPermission) {
  if (!data) {
    return false;
  }

  if (data.permission === targetPermission && data.status === "success") {
    return true;
  }

  if (Array.isArray(data)) {
    return data.some((permission) => permissionGranted(permission, targetPermission));
  }

  if (Array.isArray(data.permissions)) {
    return permissionGranted(data.permissions, targetPermission);
  }

  if (Array.isArray(data.granted_permissions)) {
    return permissionGranted(data.granted_permissions, targetPermission);
  }

  if (typeof data.permissions === "object" && data.permissions !== null) {
    const permissionState = data.permissions[targetPermission];

    if (permissionState === true) {
      return true;
    }

    if (typeof permissionState === "string") {
      return permissionState === "granted";
    }

    if (typeof permissionState === "object" && permissionState !== null) {
      return permissionState.granted === true || permissionState.status === "granted";
    }
  }

  if (typeof data[targetPermission] === "boolean") {
    return data[targetPermission];
  }

  if (typeof data === "string") {
    return data === targetPermission;
  }

  if (typeof data.permission === "string" && data.permission === targetPermission) {
    return data.granted === true || data.status === "granted" || data.status === "success";
  }

  if (typeof data.name === "string" && data.name === targetPermission) {
    return data.granted === true || data.status === "granted";
  }

  return false;
}

export function getWorldAppContext() {
  const isBrowser = typeof window !== "undefined";
  const fallbackWorldApp = isBrowser ? window.WorldApp : null;

  try {
    return {
      isInstalled: MiniKit.isInstalled(),
      user: MiniKit.user || fallbackWorldApp?.user || null,
      deviceProperties: MiniKit.deviceProperties || fallbackWorldApp?.deviceProperties || null,
      location: MiniKit.location || fallbackWorldApp?.location || null,
    };
  } catch {
    return {
      isInstalled: Boolean(fallbackWorldApp),
      user: fallbackWorldApp?.user || null,
      deviceProperties: fallbackWorldApp?.deviceProperties || null,
      location: fallbackWorldApp?.location || null,
    };
  }
}

export function formatWorldLaunchSource(location) {
  const primarySource = location?.open_origin ?? location?.source;

  if (typeof primarySource === "string" && primarySource.trim()) {
    return primarySource;
  }

  if (primarySource && typeof primarySource === "object") {
    const candidate =
      primarySource.name ||
      primarySource.label ||
      primarySource.source ||
      primarySource.type ||
      primarySource.origin;

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return "World App";
}

export async function connectWithWorldAppWallet() {
  if (!MiniKit.isInstalled()) {
    throw new Error("Open this app inside World App to continue with wallet authentication.");
  }

  const { nonce, nonceSignature } = await requestServerNonce();
  const { data } = await runMiniKitCommand("walletAuth", {
    nonce,
    requestId: "tmpesa-wallet-auth",
    statement: "Sign in to TMpesa inside World App",
    expirationTime: new Date(Date.now() + 1000 * 60 * 10),
    notBefore: new Date(Date.now() - 1000 * 60),
  });

  const verification = await completeSiweVerification(data, nonce, nonceSignature);

  if (!verification.isValid) {
    throw new Error("Wallet authentication could not be verified by the backend.");
  }

  let resolvedUser = MiniKit.user;

  if (!resolvedUser?.username && verification.address) {
    try {
      resolvedUser = await MiniKit.getUserByAddress(verification.address);
    } catch {
      resolvedUser = MiniKit.user;
    }
  }

  return {
    walletAddress: verification.address || data.address,
    signature: data.signature,
    nonce,
    username: resolvedUser?.username || "",
    fullName: resolvedUser?.username || "World App user",
    preferredCurrency: MiniKit.user?.preferredCurrency || "KES",
    worldAppVersion: MiniKit.deviceProperties?.worldAppVersion || null,
  };
}

export function canUseWorldPay(asset) {
  return APP_CONFIG.worldPaySupportedAssets.includes(asset);
}

export function buildWorldAppDeeplink(path = "/") {
  const appId = APP_CONFIG.worldAppId;

  if (!appId) {
    return "";
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://worldcoin.org/mini-app?app_id=${encodeURIComponent(appId)}&path=${encodeURIComponent(normalizedPath)}`;
}

export async function requestWorldPayment({ amount, asset = "WLD", description, to }) {
  if (!MiniKit.isInstalled()) {
    throw new Error("Open TMpesa inside World App to send WLD without leaving the mini app.");
  }

  if (!canUseWorldPay(asset)) {
    throw new Error(`${asset} payments inside TMpesa are not enabled yet.`);
  }

  if (!to?.trim()) {
    throw new Error("Set the sell wallet address in the admin dashboard before using in-app send.");
  }

  const paymentReference = (await createPaymentReference()).reference;

  const { data } = await runMiniKitCommand("pay", {
    reference: paymentReference,
    to: to.trim(),
    tokens: [
      {
        symbol: asset,
        token_amount: toTokenUnits(amount, TOKEN_DECIMALS[asset] || 18),
      },
    ],
    description,
  });

  const normalizedPayload = {
    ...data,
    transactionId: data.transactionId || data.transaction_id,
  };

  const confirmation = await confirmWorldPayment(normalizedPayload);

  return {
    chain: data.chain,
    from: data.from,
    reference: data.reference,
    timestamp: data.timestamp,
    transactionId: normalizedPayload.transactionId,
    verified: confirmation.verified,
    transactionStatus: confirmation.transactionStatus,
  };
}

export async function requestWorldVerification({
  action = APP_CONFIG.highValueOrderAction,
  signal,
  verificationLevel = "device",
}) {
  if (!MiniKit.isInstalled()) {
    throw new Error("Open TMpesa inside World App to complete the human verification step.");
  }

  const verificationPayload = {
    action,
    signal,
    verification_level: verificationLevel,
  };

  const { data } = await runMiniKitCommand("verify", verificationPayload);
  const verification = await verifyHighValueOrder(data, action, signal);

  if (!verification?.success) {
    throw new Error(verification?.error || "TMpesa could not verify this order.");
  }

  return {
    verificationLevel: data.verification_level || verificationLevel,
    nullifierHash: data.nullifier_hash,
    merkleRoot: data.merkle_root,
    signal,
  };
}

export async function getWorldNotificationPermissionState() {
  if (!MiniKit.isInstalled()) {
    return { granted: false, available: false };
  }

  try {
    const { data } = await runMiniKitCommand("getPermissions");

    const granted = permissionGranted(data, "notifications");

    if (granted && typeof window !== "undefined") {
      window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
    }

    return {
      granted,
      available: true,
      permissions: data?.permissions || data || {},
    };
  } catch {
    const grantedFromStorage =
      typeof window !== "undefined" &&
      window.localStorage.getItem(NOTIFICATION_ALLOWED_STORAGE_KEY) === "true";

    return {
      granted: grantedFromStorage,
      available: grantedFromStorage,
      permissions: {},
    };
  }
}

export async function requestWorldNotificationPermission() {
  if (!MiniKit.isInstalled()) {
    throw new Error("Open TMpesa inside World App to enable order notifications.");
  }

  const currentPermissions = await getWorldNotificationPermissionState();

  if (currentPermissions.granted) {
    return currentPermissions;
  }

  const { data } = await runMiniKitCommand("requestPermission", {
    permission: "notifications",
  });

  const granted = permissionGranted(data, "notifications");

  if (granted && typeof window !== "undefined") {
    window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
  }

  return {
    granted,
    available: true,
    permissions: data,
  };
}

export async function shareMiniAppInvite({ title, text, url }) {
  if (!MiniKit.isInstalled()) {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text, url });
      return { shared: true, via: "browser" };
    }

    throw new Error("Open TMpesa inside World App to share your invite.");
  }

  await runMiniKitCommand("share", { title, text, url });
  return { shared: true, via: "world-app" };
}

export async function openWorldChatInvite({ message }) {
  if (!MiniKit.isInstalled()) {
    throw new Error("Open TMpesa inside World App to send an invite through World Chat.");
  }

  await runMiniKitCommand("chat", { message });
  return { opened: true };
}

export async function checkWorldHumanVerification(walletAddress) {
  const normalizedAddress = String(walletAddress || "").trim();

  if (!normalizedAddress) {
    return false;
  }

  try {
    return Boolean(await getIsUserVerified(normalizedAddress));
  } catch {
    return false;
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export async function waitForWorldHumanVerification(
  walletAddress,
  { attempts = 6, intervalMs = 1500 } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const isVerified = await checkWorldHumanVerification(walletAddress);

    if (isVerified) {
      return true;
    }

    if (attempt < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  return false;
}
