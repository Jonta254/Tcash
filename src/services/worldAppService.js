import { MiniKit } from "@worldcoin/minikit-js";
import { APP_CONFIG } from "../config/appConfig";
import {
  completeSiweVerification,
  confirmWorldPayment,
  createPaymentReference,
  requestServerNonce,
} from "./backendService";

const NOTIFICATION_ALLOWED_STORAGE_KEY = "worldtmpesa_notification_allowed";
const NOTIFICATION_REQUESTED_STORAGE_KEY = "worldtmpesa_notification_permission_requested";
const NOTIFICATION_PERMISSION = "notifications";
const NOTIFICATION_REQUEST_COOLDOWN_MS = 1000 * 60 * 2;
const notificationPermissionCache = {
  checkedAt: 0,
  value: null,
};
let notificationPermissionRequest = null;
const TOKEN_DECIMALS = {
  WLD: 18,
  USDC: 6,
};
const WORLD_PAY_TOKEN_BY_ASSET = {
  WLD: "WLD",
  USDC: "USDC",
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
  // World docs: prefer commandsAsync (the documented async API)
  const command =
    MiniKit.commandsAsync?.[commandName] ||
    MiniKit[`${commandName}Async`] ||
    MiniKit[commandName];

  if (!command) {
    throw new Error(`World App command ${commandName} is not available in this MiniKit version.`);
  }

  const result = await command.call(MiniKit, payload);

  // World docs: async commands return { finalPayload } or { commandPayload, finalPayload }
  const data = result?.finalPayload || result?.data || result;

  if (data?.status === "error") {
    const error = new Error(data?.message || `World App ${commandName} command was cancelled.`);
    error.code = data?.code || data?.error_code || data?.error;
    throw error;
  }

  return { result, data };
}

function persistNotificationPermissionGranted() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(NOTIFICATION_ALLOWED_STORAGE_KEY, "true");
  }
}

function getWorldCommandErrorCode(error) {
  if (!error || typeof error !== "object") {
    return "";
  }

  return String(
    error.code ||
      error.error_code ||
      error.error ||
      error.data?.code ||
      error.data?.error_code ||
      "",
  );
}

function readStoredNotificationPermission() {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(NOTIFICATION_ALLOWED_STORAGE_KEY) === "true"
  );
}

function readLastNotificationRequestAt() {
  return typeof window === "undefined"
    ? 0
    : Number(window.localStorage.getItem(NOTIFICATION_REQUESTED_STORAGE_KEY) || 0);
}

function markNotificationPermissionRequested() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(NOTIFICATION_REQUESTED_STORAGE_KEY, Date.now().toString());
  }
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
  return APP_CONFIG.worldPaySupportedAssets.includes(asset) && Boolean(WORLD_PAY_TOKEN_BY_ASSET[asset]);
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
  const tokenSymbol = WORLD_PAY_TOKEN_BY_ASSET[asset];

  const { data } = await runMiniKitCommand("pay", {
    reference: paymentReference,
    to: to.trim(),
    tokens: [
      {
        symbol: tokenSymbol,
        token_amount: toTokenUnits(amount, TOKEN_DECIMALS[asset] || 18),
      },
    ],
    description,
    fallback: () => ({
      status: "error",
      message: "Open TMpesa inside World App to complete this payment.",
    }),
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

export async function getWorldNotificationPermissionState({ command = false } = {}) {
  if (!MiniKit.isInstalled()) {
    return { granted: false, available: false };
  }

  if (!command) {
    return {
      granted: readStoredNotificationPermission(),
      available: true,
      permissions: {},
    };
  }

  if (
    notificationPermissionCache.value &&
    Date.now() - notificationPermissionCache.checkedAt < 15_000
  ) {
    return notificationPermissionCache.value;
  }

  try {
    const { data } = await runMiniKitCommand("getPermissions");

    const granted = permissionGranted(data, NOTIFICATION_PERMISSION);

    if (granted) {
      persistNotificationPermissionGranted();
    }

    const permissionState = {
      granted,
      available: true,
      permissions: data?.permissions || data || {},
    };

    notificationPermissionCache.checkedAt = Date.now();
    notificationPermissionCache.value = permissionState;
    return permissionState;
  } catch {
    const permissionState = {
      granted: readStoredNotificationPermission(),
      available: true,
      permissions: {},
    };

    notificationPermissionCache.checkedAt = Date.now();
    notificationPermissionCache.value = permissionState;
    return permissionState;
  }
}

export async function requestWorldNotificationPermission() {
  if (!MiniKit.isInstalled()) {
    throw new Error("Open TMpesa inside World App to enable order notifications.");
  }

  if (notificationPermissionRequest) {
    return notificationPermissionRequest;
  }

  const currentPermissions = await getWorldNotificationPermissionState({ command: false });

  if (currentPermissions.granted) {
    return currentPermissions;
  }

  const lastRequestedAt = readLastNotificationRequestAt();

  if (lastRequestedAt && Date.now() - lastRequestedAt < NOTIFICATION_REQUEST_COOLDOWN_MS) {
    throw new Error("World permission was just requested. Wait a moment before trying again.");
  }

  notificationPermissionRequest = (async () => {
    markNotificationPermissionRequested();
    try {
      const { data } = await runMiniKitCommand("requestPermission", {
        permission: NOTIFICATION_PERMISSION,
      });

      if (permissionGranted(data, NOTIFICATION_PERMISSION)) {
        persistNotificationPermissionGranted();
        const permissionState = {
          granted: true,
          available: true,
          permissions: data,
        };
        notificationPermissionCache.checkedAt = Date.now();
        notificationPermissionCache.value = permissionState;
        return permissionState;
      }

      return {
        granted: false,
        available: true,
        permissions: data || {},
      };
    } catch (error) {
      const code = getWorldCommandErrorCode(error);

      if (code === "already_granted") {
        persistNotificationPermissionGranted();
        const permissionState = {
          granted: true,
          available: true,
          permissions: { notifications: "granted" },
        };
        notificationPermissionCache.checkedAt = Date.now();
        notificationPermissionCache.value = permissionState;
        return permissionState;
      }

      if (code === "already_requested" || code === "user_rejected") {
        return {
          granted: false,
          available: true,
          permissions: {},
        };
      }

      throw error;
    }
  })();

  try {
    return await notificationPermissionRequest;
  } finally {
    notificationPermissionRequest = null;
  }
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

/**
 * Haptic feedback — silently ignored outside World App.
 * type: "light" | "medium" | "heavy" | "soft" | "rigid" | "success" | "warning" | "error"
 */
export function haptic(type = "light") {
  if (!MiniKit.isInstalled()) return;
  try {
    MiniKit.commands?.sendHapticFeedback?.({ hapticType: type });
  } catch {
    // silently ignore — haptics are enhancement only
  }
}

/**
 * Gracefully close the mini app (calls World's closeMiniApp command).
 * Falls back to logoutUser + navigation if not inside World App.
 */
export async function closeMiniApp() {
  if (MiniKit.isInstalled()) {
    try {
      await runMiniKitCommand("closeMiniApp", {});
      return;
    } catch {
      // fall through to normal logout
    }
  }
}
