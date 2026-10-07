export { buildCoinGeckoRates, buildWorldRates, buildUsdKesRate, parseWorldMoney } from "../src/services/marketQuote.js";
import { buildCoinGeckoRates, buildWorldRates, buildUsdKesRate } from "../src/services/marketQuote.js";
import { allowMethods, sendJson } from "./_lib/http.js";

const COINGECKO_PRICES_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=worldcoin-wld,usd-coin&vs_currencies=kes,usd&include_last_updated_at=true&precision=full";

const WORLD_PRICES_URL =
  "https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?fiatCurrencies=KES&cryptoCurrencies=WLD,USDC";
const BINANCE_WLD_USDT_URL = "https://api.binance.com/api/v3/ticker/price?symbol=WLDUSDT";
const USD_KES_URL = "https://open.er-api.com/v6/latest/USD";

function parsePositiveNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildBinanceRates(payload, usdKesRate, fallbackUsdcKes) {
  const wldUsdt = parsePositiveNumber(payload?.price);

  if (wldUsdt <= 0 || usdKesRate <= 1) {
    return null;
  }

  return {
    WLD: wldUsdt * usdKesRate,
    USDC: fallbackUsdcKes > 1 ? fallbackUsdcKes : usdKesRate,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(7000),
  });

  return {
    ok: response.ok,
    payload: await response.json().catch(() => ({})),
  };
}

export async function getFreshMarketQuote() {
    const [worldResult, coinGeckoResult, binanceResult, usdKesResult] = await Promise.allSettled([
      fetchJson(WORLD_PRICES_URL),
      fetchJson(COINGECKO_PRICES_URL),
      fetchJson(BINANCE_WLD_USDT_URL),
      fetchJson(USD_KES_URL),
    ]);

    const worldRates =
      worldResult.status === "fulfilled" && worldResult.value.ok
        ? buildWorldRates(worldResult.value.payload)
        : null;

    const usdKesRate =
      usdKesResult.status === "fulfilled" && usdKesResult.value.ok
        ? buildUsdKesRate(usdKesResult.value.payload)
        : 0;

    const coinGeckoRates =
      coinGeckoResult.status === "fulfilled" && coinGeckoResult.value.ok
        ? buildCoinGeckoRates(coinGeckoResult.value.payload, usdKesRate)
        : null;

    const binanceRates =
      binanceResult.status === "fulfilled" && binanceResult.value.ok
        ? buildBinanceRates(
            binanceResult.value.payload,
            usdKesRate,
            coinGeckoRates?.USDC || worldRates?.USDC || usdKesRate,
          )
        : null;

    const selectedRates = worldRates || coinGeckoRates || binanceRates;

  if (!selectedRates) throw new Error("Unable to load a fresh market quote. Try again before paying.");
  return {
    prices: { WLD: selectedRates.WLD, USDC: selectedRates.USDC },
    source: worldRates ? "world-public-prices" : coinGeckoRates ? "coingecko-market-fallback" : "binance-wld-usdt-plus-usd-kes",
    fetchedAt: new Date().toISOString(),
  };
}
export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try { sendJson(res, 200, { success: true, ...await getFreshMarketQuote() }); }
  catch (error) { sendJson(res, 502, { success: false, error: error.message || "Unable to load live prices." }); }
}
