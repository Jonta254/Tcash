import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig";
import { readStorage, writeStorage } from "./localStorage";

const SETTINGS_UPDATED_EVENT = "worldtmpesa:settings-updated";
const LEGACY_SELL_WALLET_ADDRESS = "0xWORLDTMPESA-WLD-WALLET-001";
const LEGACY_MPESA_PAYBILL_NUMBER = "522522";
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
    worldAppId: APP_CONFIG.worldAppId,
  };
}

function mergeSettings(settings = {}) {
  return {
    ...getDefaultSettings(),
    ...settings,
    ratesKes: {
      ...APP_CONFIG.defaultSettings.ratesKes,
      ...(settings.ratesKes || {}),
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

  if (nextSettings.sellWalletAddress === LEGACY_SELL_WALLET_ADDRESS) {
    nextSettings.sellWalletAddress = APP_CONFIG.defaultSettings.sellWalletAddress;
  }

  if (nextSettings.mpesaPaybillNumber === LEGACY_MPESA_PAYBILL_NUMBER) {
    nextSettings.mpesaPaybillNumber = APP_CONFIG.defaultSettings.mpesaPaybillNumber;
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
  return getSettings().ratesKes;
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
    ratesKes: {
      ...APP_CONFIG.defaultSettings.ratesKes,
      ...(previousSettings.ratesKes || {}),
      ...parsedRates,
    },
    updatedAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.settings, settings);
  emitSettingsUpdate(settings);
  return settings.ratesKes;
}

export function updateOperationalSettings(nextSettings) {
  const previousSettings = getSettings();
  const sellWalletAddress = (nextSettings.sellWalletAddress || "").trim();
  const mpesaPaybillNumber = (nextSettings.mpesaPaybillNumber || "").trim();
  const mpesaTillName = (nextSettings.mpesaTillName || "").trim();
  const supportEmail = (nextSettings.supportEmail || "").trim();
  if (!sellWalletAddress) {
    throw new Error("Enter the wallet address that should receive sell-side WLD payments.");
  }

  if (!mpesaPaybillNumber) {
    throw new Error("Enter the M-Pesa paybill or till number.");
  }

  if (!mpesaTillName) {
    throw new Error("Enter the M-Pesa business name.");
  }

  if (!supportEmail || !supportEmail.includes("@")) {
    throw new Error("Enter a valid support email address.");
  }

  const settings = {
    ...previousSettings,
    sellWalletAddress,
    mpesaPaybillNumber,
    mpesaTillName,
    supportEmail,
    worldAppId: APP_CONFIG.worldAppId,
    updatedAt: new Date().toISOString(),
  };

  writeStorage(STORAGE_KEYS.settings, settings);
  emitSettingsUpdate(settings);
  return settings;
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
