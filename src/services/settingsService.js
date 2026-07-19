import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { fetchSharedSettings, pushSharedSettings } from "./backendService";
import { readStorage, writeStorage } from "./localStorage";

const SETTINGS_UPDATED_EVENT = "worldtmpesa:settings-updated";
const LEGACY_SELL_WALLET_ADDRESSES = new Set([
  "0xWORLDTMPESA-WLD-WALLET-001",
  "0x0f029f35a9da4043ff84b2c98a023d0a68eb64b4".toLowerCase(),
]);
const LEGACY_MPESA_PAYBILL_NUMBER = "522522";
const LEGACY_MPESA_PAYBILL_NUMBERS = new Set([LEGACY_MPESA_PAYBILL_NUMBER, "5698981"]);
const LEGACY_MPESA_TILL_NAMES = new Set([
  "brian okindo josiah",
  "tmpesa exchange",
]);
const LEGACY_USDT_ASSET = "USDT";
const WORLD_USDC_ASSET = "USDC";
const LEGACY_SUPPORT_EMAILS = new Set([
  "brianokindo@gmail.com",
  "brianokind02022@gmail.com",
  "brianokindo2022",
  "brianokindo2022'",
]);
function getDefaultSettings() {
  return {
    ...APP_CONFIG.defaultSettings,
    ratesKes: { ...APP_CONFIG.defaultSettings.ratesKes },
    feeKesPerCoin: { ...APP_CONFIG.defaultSettings.feeKesPerCoin },
    worldAppId: APP_CONFIG.worldAppId,
  };
}

function sanitizeRates(rates = {}) {
  return Object.entries({
    ...APP_CONFIG.defaultSettings.ratesKes,
    ...rates,
  }).reduce((accumulator, [asset, value]) => {
    const parsedValue = Number(value);
    const minimumValidRate = asset === "WLD" ? 1 : 1;

    accumulator[asset] =
      parsedValue > minimumValidRate
        ? parsedValue
        : APP_CONFIG.defaultSettings.ratesKes[asset] || 0;

    return accumulator;
  }, {});
}

function mergeSettings(settings = {}) {
  return {
    ...getDefaultSettings(),
    ...settings,
    ratesKes: sanitizeRates(settings.ratesKes || {}),
    feeKesPerCoin: {
      ...APP_CONFIG.defaultSettings.feeKesPerCoin,
      ...(settings.feeKesPerCoin || {}),
    },
  };
}

function emitSettingsUpdate(nextSettings) {
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: nextSettings }));
}

export function initializeSettings() {
  const settings = readStorage(STORAGE_KEYS.settings, null);
  const defaults = getDefaultSettings();

  if (!settings) {
    writeStorage(STORAGE_KEYS.settings, defaults);
    return;
  }

  const nextSettings = mergeSettings(settings);

  if (typeof settings.rateKesPerWld === "number" && !settings.ratesKes?.WLD) {
    nextSettings.ratesKes.WLD = settings.rateKesPerWld;
  }

  if (settings.ratesKes?.[LEGACY_USDT_ASSET] && !settings.ratesKes?.[WORLD_USDC_ASSET]) {
    nextSettings.ratesKes[WORLD_USDC_ASSET] = settings.ratesKes[LEGACY_USDT_ASSET];
  }

  delete nextSettings.ratesKes[LEGACY_USDT_ASSET];

  if (LEGACY_SELL_WALLET_ADDRESSES.has(String(nextSettings.sellWalletAddress || "").toLowerCase())) {
    nextSettings.sellWalletAddress = APP_CONFIG.defaultSettings.sellWalletAddress;
  }

  if (nextSettings.mpesaPaybillNumber === LEGACY_MPESA_PAYBILL_NUMBER) {
    nextSettings.mpesaPaybillNumber = APP_CONFIG.defaultSettings.mpesaPaybillNumber;
  }

  if (LEGACY_MPESA_PAYBILL_NUMBERS.has(String(nextSettings.mpesaPaybillNumber || ""))) {
    nextSettings.mpesaPaybillNumber = APP_CONFIG.defaultSettings.mpesaPaybillNumber;
  }

  if (!nextSettings.mpesaAccountNumber) {
    nextSettings.mpesaAccountNumber = APP_CONFIG.defaultSettings.mpesaAccountNumber;
  }

  if (LEGACY_MPESA_TILL_NAMES.has(String(nextSettings.mpesaTillName || "").toLowerCase())) {
    nextSettings.mpesaTillName = APP_CONFIG.defaultSettings.mpesaTillName;
  }

  if (
    !nextSettings.supportEmail ||
    LEGACY_SUPPORT_EMAILS.has(String(nextSettings.supportEmail).toLowerCase())
  ) {
    nextSettings.supportEmail = APP_CONFIG.defaultSettings.supportEmail;
  }

  nextSettings.worldAppId = APP_CONFIG.worldAppId;

  writeStorage(STORAGE_KEYS.settings, nextSettings);
}

export function getSettings() {
  return mergeSettings(readStorage(STORAGE_KEYS.settings, {}));
}

export function getExchangeRates() {
  return sanitizeRates(getSettings().ratesKes);
}

export function getExchangeRate(asset = "WLD") {
  return getExchangeRates()[asset] || APP_CONFIG.defaultSettings.ratesKes[asset] || 0;
}

export function updateExchangeRates(nextRates) {
  const parsedRates = Object.entries(nextRates).reduce((accumulator, [asset, value]) => {
    const parsedRate = Number(value);

    if (!parsedRate || parsedRate <= 0) {
      throw new Error(`Enter a valid exchange rate above zero for ${asset}.`);
    }

    accumulator[asset] = parsedRate;
    return accumulator;
  }, {});

  const previousSettings = getSettings();

  const settings = {
    ...previousSettings,
    ratesKes: sanitizeRates({
      ...(previousSettings.ratesKes || {}),
      ...parsedRates,
    }),
    updatedAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.settings, settings);
  emitSettingsUpdate(settings);
  return settings.ratesKes;
}

export function getFeePerCoin(asset = "WLD") {
  return getSettings().feeKesPerCoin?.[asset] || APP_CONFIG.defaultSettings.feeKesPerCoin[asset] || 0;
}

// The shared write (api/settings.js, admin-only) happens *before* the
// local write, and only a confirmed success reaches local storage.
// Fee/PayBill/wallet settings existed only in this browser's
// localStorage until now, which meant "Save" here never actually
// affected the real users the admin console exists to serve — the
// whole point of this function is the shared effect, so a failed push
// (rejection or network) throws without touching local state, rather
// than showing the admin a "saved" value that only they can see.
export async function updateFeeKesPerCoin(nextFees) {
  const parsedFees = Object.entries(nextFees).reduce((accumulator, [asset, value]) => {
    const parsedFee = Number(value);

    if (parsedFee < 0 || Number.isNaN(parsedFee)) {
      throw new Error(`Enter a valid fee above or equal to zero for ${asset}.`);
    }

    accumulator[asset] = parsedFee;
    return accumulator;
  }, {});

  const result = await pushSharedSettings({ feeKesPerCoin: parsedFees });

  if (!result?.ok) {
    throw new Error(result?.error || "Tcash could not save fee settings to the shared server.");
  }

  // The server already computed the authoritative merged document
  // (including anything a concurrent admin session changed) — use it
  // directly rather than re-deriving a merge locally, which could
  // drift from what's actually shared.
  const settings = mergeSettings({ ...getSettings(), ...result.settings });
  writeStorage(STORAGE_KEYS.settings, settings);
  emitSettingsUpdate(settings);
  return settings.feeKesPerCoin;
}

export async function updateOperationalSettings(nextSettings) {
  const sellWalletAddress = (nextSettings.sellWalletAddress || "").trim();
  const mpesaPaybillNumber = (nextSettings.mpesaPaybillNumber || "").trim();
  const mpesaAccountNumber = (nextSettings.mpesaAccountNumber || "").trim();
  const mpesaTillName = (nextSettings.mpesaTillName || "").trim();
  const supportEmail = (nextSettings.supportEmail || "").trim();
  if (!sellWalletAddress) {
    throw new Error("Enter the wallet address that should receive sell-side WLD payments.");
  }

  if (!mpesaPaybillNumber) {
    throw new Error("Enter the M-Pesa paybill number.");
  }

  if (!mpesaAccountNumber) {
    throw new Error("Enter the M-Pesa account number.");
  }

  if (!mpesaTillName) {
    throw new Error("Enter the M-Pesa business name.");
  }

  if (!supportEmail || !supportEmail.includes("@")) {
    throw new Error("Enter a valid support email address.");
  }

  const result = await pushSharedSettings({
    sellWalletAddress,
    mpesaPaybillNumber,
    mpesaAccountNumber,
    mpesaTillName,
    supportEmail,
  });

  if (!result?.ok) {
    throw new Error(result?.error || "Tcash could not save these settings to the shared server.");
  }

  // Same reasoning as updateFeeKesPerCoin: trust the server's own
  // merged document over re-deriving one locally. worldAppId is never
  // part of the shared document (it's a build-time config value, not
  // an admin-editable one — always resolved from APP_CONFIG).
  const settings = mergeSettings({
    ...getSettings(),
    ...result.settings,
    worldAppId: APP_CONFIG.worldAppId,
  });
  writeStorage(STORAGE_KEYS.settings, settings);
  emitSettingsUpdate(settings);
  return settings;
}

// Called once on app boot (main.jsx) so every user's session — not
// just the admin's own browser — picks up whatever the operator last
// saved. Tolerant of failure: an unreachable server or a fresh
// deployment with Redis not yet configured must never block the app
// from rendering with whatever's cached locally (or the shipped
// defaults, on a first-ever load).
export async function refreshSharedSettings() {
  try {
    const payload = await fetchSharedSettings();

    if (payload?.ok && payload.settings) {
      const merged = mergeSettings({ ...getSettings(), ...payload.settings });
      writeStorage(STORAGE_KEYS.settings, merged);
      emitSettingsUpdate(merged);
      return merged;
    }
  } catch {
    // Transient — keep whatever's already cached locally.
  }

  return getSettings();
}

export function subscribeToSettings(callback) {
  const handleSettingsUpdate = (event) => {
    callback(event.detail);
  };

  const handleStorage = () => {
    callback(getSettings());
  };

  window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
    window.removeEventListener("storage", handleStorage);
  };
}

export function subscribeToRateUpdates(callback) {
  return subscribeToSettings((settings) => callback(settings.ratesKes));
}
