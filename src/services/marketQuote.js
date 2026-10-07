function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function fresh(timestamp, maxAgeMs) {
  const age = Date.now() - Number(timestamp || 0) * 1000;
  return age >= 0 && age <= maxAgeMs;
}

export function parseWorldMoney(entry) {
  const decimals = Number(entry?.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) return 0;
  return positive(entry?.amount) / 10 ** decimals;
}

export function buildWorldRates(payload) {
  const prices = payload?.result?.prices;
  const WLD = parseWorldMoney(prices?.WLD?.KES);
  const USDC = parseWorldMoney(prices?.USDC?.KES);
  return WLD > 1 && USDC > 1 ? { WLD, USDC } : null;
}

export function buildUsdKesRate(payload) {
  if (payload?.result !== "success" || payload?.base_code !== "USD" ||
      !fresh(payload?.time_last_update_unix, 48 * 60 * 60 * 1000)) return 0;
  return positive(payload?.rates?.KES);
}

export function buildCoinGeckoRates(payload, usdKesRate = 0) {
  const wld = payload?.["worldcoin-wld"];
  const usdc = payload?.["usd-coin"];
  if (!fresh(wld?.last_updated_at, 20 * 60 * 1000) ||
      !fresh(usdc?.last_updated_at, 20 * 60 * 1000)) return null;
  const WLD = positive(wld?.kes) || positive(wld?.usd) * usdKesRate;
  const USDC = positive(usdc?.kes) || positive(usdc?.usd) * usdKesRate;
  return WLD > 1 && USDC > 1 ? { WLD, USDC } : null;
}
