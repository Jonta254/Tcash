import { allowMethods, sendJson } from "./_lib/http.js";

const COINGECKO_PRICES_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=worldcoin,usd-coin,tether&vs_currencies=kes,usd&include_last_updated_at=true&precision=full";

const WORLD_PRICES_URL =
  "https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?fiatCurrencies=KES&cryptoCurrencies=WLD,USDC";
const BINANCE_WLD_USDT_URL = "https://api.binance.com/api/v3/ticker/price?symbol=WLDUSDT";
const USD_KES_URL = "https://open.er-api.com/v6/latest/USD";

function parsePositiveNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildStableKesReference(payload) {
  const usdcKes = parsePositiveNumber(payload?.["usd-coin"]?.kes);
  const usdcUsd = parsePositiveNumber(payload?.["usd-coin"]?.usd);
  const usdtKes = parsePositiveNumber(payload?.tether?.kes);
  const usdtUsd = parsePositiveNumber(payload?.tether?.usd);

  const stableKesCandidates = [
    usdcKes > 1 && usdcUsd > 0 ? usdcKes / usdcUsd : 0,
    usdtKes > 1 && usdtUsd > 0 ? usdtKes / usdtUsd : 0,
  ].filter((value) => value > 0);

  const kesPerUsd = stableKesCandidates.length
    ? stableKesCandidates.reduce((sum, value) => sum + value, 0) / stableKesCandidates.length
    : 0;

  return {
    kesPerUsd,
    stableKes: usdcKes > 1 ? usdcKes : usdtKes,
  };
}

function buildCoinGeckoRates(payload) {
  const directWldKes = parsePositiveNumber(payload?.worldcoin?.kes);
  const wldUsd = parsePositiveNumber(payload?.worldcoin?.usd);
  const { kesPerUsd, stableKes } = buildStableKesReference(payload);
  const derivedWldKes = wldUsd > 0 && kesPerUsd > 0 ? wldUsd * kesPerUsd : 0;
  const wldKes =
    derivedWldKes > 1
      ? derivedWldKes
      : directWldKes > 1
        ? directWldKes
        : 0;

  return {
    WLD: wldKes,
    USDC: stableKes,
    lastUpdatedAt: Number(payload?.worldcoin?.last_updated_at || 0),
  };
}

function isFreshTimestamp(unixSeconds) {
  const timestamp = Number(unixSeconds || 0);

  if (!timestamp) {
    return false;
  }

  const ageMs = Date.now() - timestamp * 1000;
  return ageMs >= 0 && ageMs <= 1000 * 60 * 20;
}

/**
 * World's price feed returns fixed-point money objects, not plain numbers:
 *   "KES": { asset: "KES", amount: "50444262334490", decimals: 12 }
 * which is 50.444262334490 KES. This was previously read as
 * Number({...}) === NaN, so World's own feed — the most authoritative
 * source available to a World mini app, and the only one of the four that
 * isn't geo-blocked or rate-limited from Vercel — silently never produced
 * a rate and the endpoint fell through to a 502.
 */
export function parseWorldMoney(entry) {
  const amount = Number(entry?.amount);
  const decimals = Number(entry?.decimals);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 30) {
    return 0;
  }

  return amount / 10 ** decimals;
}

export function buildWorldRates(payload) {
  const worldPrices = payload?.result?.prices || {};
  const worldWldKes = parseWorldMoney(worldPrices?.WLD?.KES);
  const worldUsdcKes = parseWorldMoney(worldPrices?.USDC?.KES);

  if (worldWldKes <= 1 || worldUsdcKes <= 1) {
    return null;
  }

  return {
    WLD: worldWldKes,
    USDC: worldUsdcKes,
  };
}

function buildUsdKesRate(payload) {
  return parsePositiveNumber(payload?.rates?.KES);
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
  });

  return {
    ok: response.ok,
    payload: await response.json().catch(() => ({})),
  };
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");

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

    const coinGeckoRates =
      coinGeckoResult.status === "fulfilled" && coinGeckoResult.value.ok
        ? buildCoinGeckoRates(coinGeckoResult.value.payload)
        : null;

    const freshCoinGeckoRates =
      coinGeckoRates &&
      coinGeckoRates.WLD > 1 &&
      coinGeckoRates.USDC > 1 &&
      isFreshTimestamp(coinGeckoRates.lastUpdatedAt)
        ? coinGeckoRates
        : null;

    const usdKesRate =
      usdKesResult.status === "fulfilled" && usdKesResult.value.ok
        ? buildUsdKesRate(usdKesResult.value.payload)
        : 0;

    const binanceRates =
      binanceResult.status === "fulfilled" && binanceResult.value.ok
        ? buildBinanceRates(
            binanceResult.value.payload,
            usdKesRate,
            freshCoinGeckoRates?.USDC || worldRates?.USDC || usdKesRate,
          )
        : null;

    // World's feed first: it is quoted directly in KES (no USD cross-rate to
    // compound error), it is World's own number for a World mini app, and it
    // is reachable from Vercel — Binance answers 451 from US regions, and
    // CoinGecko's `worldcoin` entry has been serving a months-stale price
    // (caught by isFreshTimestamp, which is why it isn't simply trusted).
    const selectedRates = worldRates || binanceRates || freshCoinGeckoRates;

    if (!selectedRates) {
      sendJson(res, 502, {
        success: false,
        error: "Unable to load a fresh live market quote right now.",
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      prices: {
        WLD: selectedRates.WLD,
        USDC: selectedRates.USDC,
      },
      source: worldRates
        ? "world-public-prices"
        : binanceRates
          ? "binance-wld-usdt-plus-usd-kes"
          : "coingecko-market-fallback",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load live prices.",
    });
  }
}
