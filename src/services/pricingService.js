import { APP_CONFIG } from "../config/appConfig";
import { getFeePerCoin, getExchangeRate } from "./settingsService";

export function formatKES(value) {
  const amount = Number(value || 0);
  return `KES ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCryptoAmount(value, maximumFractionDigits = 4) {
  const amount = Number(value || 0);
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function calculateBuyRate(marketPriceKes, feeKes) {
  const market = Number(marketPriceKes || 0);
  const fee = Number(feeKes || 0);
  return Math.max(market + fee, 0);
}

export function calculateSellRate(marketPriceKes, feeKes) {
  const market = Number(marketPriceKes || 0);
  const fee = Number(feeKes || 0);
  return Math.max(market - fee, 0);
}

export function getAssetPricing(asset, liveRates = {}) {
  const marketPriceKes =
    Number(liveRates?.[asset]) ||
    Number(getExchangeRate(asset)) ||
    Number(APP_CONFIG.defaultSettings.ratesKes?.[asset]) ||
    0;
  const feeKes = Number(getFeePerCoin(asset) || 0);

  return {
    asset,
    marketPriceKes,
    feeKes,
    buyRateKes: calculateBuyRate(marketPriceKes, feeKes),
    sellRateKes: calculateSellRate(marketPriceKes, feeKes),
    hasLiveRate: marketPriceKes > 0,
  };
}

export function calculateKesWalletBalance(assets = [], liveRates = {}) {
  return assets.reduce((sum, assetEntry) => {
    const balance = Number(assetEntry.formattedBalance || assetEntry.balance || 0);
    const marketPriceKes = Number(liveRates?.[assetEntry.symbol] || 0);

    return sum + balance * marketPriceKes;
  }, 0);
}
