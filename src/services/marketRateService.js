import { updateExchangeRates } from "./settingsService";

const LAST_LIVE_RATES_SESSION_KEY = "worldtmpesa_last_live_rates";
const LAST_LIVE_RATES_STORAGE_KEY = "worldtmpesa_last_live_rates_storage";
const MARKET_REQUEST_TIMEOUT_MS = 7000;
const WORLD_PRICES_URL =
  "https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?fiatCurrencies=KES&cryptoCurrencies=WLD,USDC";
const COINGECKO_PRICES_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=worldcoin,usd-coin,tether&vs_currencies=kes,usd&include_last_updated_at=true&precision=full";
const BINANCE_WLD_USDT_URL = "https://api.binance.com/api/v3/ticker/price?symbol=WLDUSDT";
const USD_KES_URL = "https://open.er-api.com/v6/latest/USD";

function withTimeout(promiseFactory, timeoutMs, timeoutMessage) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutId = null;

  if (controller) {
    timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  }

  return promiseFactory(controller?.signal)
    .catch((error) => {
      if (error?.name === "AbortError") {
        throw new Error(timeoutMessage);
      }

      throw error;
    })
    .finally(() => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    });
}

function buildCachedResponse(source = "session-last-live-rates") {
  const lastRates = getLastLiveMarketRates();

  if (!lastRates) {
    return null;
  }

  return {
    rates: {
      ...lastRates,
    },
    source,
    fetchedAt: new Date().toISOString(),
    isFallback: true,
  };
}

function parsePositiveNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isFreshTimestamp(unixSeconds) {
  const timestamp = Number(unixSeconds || 0);

  if (!timestamp) {
    return false;
  }

  const ageMs = Date.now() - timestamp * 1000;
  return ageMs >= 0 && ageMs <= 1000 * 60 * 20;
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

  if (wldKes <= 1 || stableKes <= 1 || !isFreshTimestamp(payload?.worldcoin?.last_updated_at)) {
    return null;
  }

  return {
    WLD: wldKes,
    USDC: stableKes,
  };
}

function buildWorldRates(payload) {
  const worldPrices = payload?.result?.prices || {};
  const worldWldKes = parsePositiveNumber(worldPrices?.WLD?.KES);
  const worldUsdcKes = parsePositiveNumber(worldPrices?.USDC?.KES);

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

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal,
  });

  return {
    ok: response.ok,
    payload: await response.json().catch(() => ({})),
  };
}

async function fetchDirectMarketRates() {
  return withTimeout(
    async (signal) => {
      const [worldResult, coinGeckoResult, binanceResult, usdKesResult] = await Promise.allSettled([
        fetchJson(WORLD_PRICES_URL, signal),
        fetchJson(COINGECKO_PRICES_URL, signal),
        fetchJson(BINANCE_WLD_USDT_URL, signal),
        fetchJson(USD_KES_URL, signal),
      ]);

      const worldRates =
        worldResult.status === "fulfilled" && worldResult.value.ok
          ? buildWorldRates(worldResult.value.payload)
          : null;

      const coinGeckoRates =
        coinGeckoResult.status === "fulfilled" && coinGeckoResult.value.ok
          ? buildCoinGeckoRates(coinGeckoResult.value.payload)
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
              coinGeckoRates?.USDC || worldRates?.USDC || usdKesRate,
            )
          : null;

      const selectedRates = binanceRates || worldRates || coinGeckoRates;

      if (!selectedRates) {
        throw new Error("TMpesa could not load direct live market prices.");
      }

      return {
        rates: {
          WLD: selectedRates.WLD,
          USDC: selectedRates.USDC,
        },
        source: binanceRates
          ? "binance-wld-usdt-plus-usd-kes"
          : worldRates
            ? "world-public-prices-direct"
            : "coingecko-market-direct",
        fetchedAt: new Date().toISOString(),
        isFallback: false,
      };
    },
    MARKET_REQUEST_TIMEOUT_MS,
    "TMpesa could not refresh direct market prices right now.",
  );
}

function rememberRates(rates) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(LAST_LIVE_RATES_SESSION_KEY, JSON.stringify(rates));
      window.localStorage.setItem(LAST_LIVE_RATES_STORAGE_KEY, JSON.stringify(rates));
    }
  } catch {
    // Ignore session persistence issues.
  }

  try {
    updateExchangeRates(rates);
  } catch {
    // Ignore local persistence issues.
  }
}

export function getLastLiveMarketRates() {
  if (typeof window === "undefined") {
    return null;
  }

  const readValidRates = (stored) => {
    try {
      const parsed = JSON.parse(stored || "null");
      const wldRate = Number(parsed?.WLD || 0);
      const usdcRate = Number(parsed?.USDC || 0);

      if (wldRate > 0 && usdcRate > 0) {
        return {
          WLD: wldRate,
          USDC: usdcRate,
        };
      }
    } catch {
      return null;
    }

    return null;
  };

  try {
    const sessionRates = readValidRates(window.sessionStorage.getItem(LAST_LIVE_RATES_SESSION_KEY));

    if (sessionRates) {
      return sessionRates;
    }
  } catch {
    // Ignore session parsing issues and continue to localStorage.
  }

  try {
    const persistedRates = readValidRates(window.localStorage.getItem(LAST_LIVE_RATES_STORAGE_KEY));

    if (persistedRates) {
      return persistedRates;
    }
  } catch {
    // Ignore local persistence issues and fall through to null.
  }

  return null;
}

export async function fetchWorldMarketRates() {
  try {
    const response = await withTimeout(
      (signal) =>
        fetch(`/api/world-prices?ts=${Date.now()}`, {
          cache: "no-store",
          signal,
        }),
      MARKET_REQUEST_TIMEOUT_MS,
      "TMpesa could not refresh live market prices right now.",
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "TMpesa could not load live market prices.");
    }

    const wldRate = Number(payload?.prices?.WLD || 0);
    const usdcRate = Number(payload?.prices?.USDC || 0);

    if (wldRate <= 0 || usdcRate <= 0) {
      throw new Error("TMpesa received an incomplete live market quote.");
    }

    const rates = {
      WLD: wldRate,
      USDC: usdcRate,
    };
    rememberRates(rates);

    return {
      rates: {
        ...rates,
      },
      source: payload?.source || "live-market-prices",
      fetchedAt: payload?.fetchedAt || null,
      isFallback: Boolean(payload?.fallback),
    };
  } catch {
    try {
      const directMarketRates = await fetchDirectMarketRates();
      rememberRates(directMarketRates.rates);
      return directMarketRates;
    } catch {
      const cachedResponse = buildCachedResponse("session-last-live-rates");

      if (cachedResponse) {
        return cachedResponse;
      }

      throw new Error("TMpesa could not load live market prices.");
    }
  }
}
