import { updateExchangeRates } from "./settingsService";

const LAST_LIVE_RATES_SESSION_KEY = "worldtmpesa_last_live_rates";

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

function rememberRates(rates) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(LAST_LIVE_RATES_SESSION_KEY, JSON.stringify(rates));
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

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(LAST_LIVE_RATES_SESSION_KEY) || "null");
    const wldRate = Number(stored?.WLD || 0);
    const usdcRate = Number(stored?.USDC || 0);

    if (wldRate > 0 && usdcRate > 0) {
      return {
        WLD: wldRate,
        USDC: usdcRate,
      };
    }
  } catch {
    // Ignore session parsing issues and fall through to null.
  }

  return null;
}

export async function fetchWorldMarketRates() {
  const response = await fetch(`/api/world-prices?ts=${Date.now()}`, {
    cache: "no-store",
  }).catch(() => {
    const cachedResponse = buildCachedResponse();

    if (cachedResponse) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          prices: cachedResponse.rates,
          source: cachedResponse.source,
          fetchedAt: cachedResponse.fetchedAt,
          fallback: true,
        }),
      };
    }

    throw new Error("TMpesa could not load live market prices.");
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.success) {
    const cachedResponse = buildCachedResponse("session-last-live-rates-after-api-error");

    if (cachedResponse) {
      return cachedResponse;
    }

    throw new Error(payload?.error || "TMpesa could not load live market prices.");
  }

  const wldRate = Number(payload?.prices?.WLD || 0);
  const usdcRate = Number(payload?.prices?.USDC || 0);

  if (wldRate <= 0 || usdcRate <= 0) {
    const cachedResponse = buildCachedResponse("session-last-live-rates-after-incomplete-quote");

    if (cachedResponse) {
      return cachedResponse;
    }

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
}
