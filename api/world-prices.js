import { allowMethods, sendJson } from "./_lib/http.js";

const COINGECKO_PRICES_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=worldcoin,usd-coin,tether&vs_currencies=kes,usd";

const WORLD_PRICES_URL =
  "https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?fiatCurrencies=KES&cryptoCurrencies=WLD,USDC";

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
  };
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const worldResponse = await fetch(WORLD_PRICES_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    const worldPayload = await worldResponse.json().catch(() => ({}));
    const worldPrices = worldPayload?.result?.prices || {};
    const worldWldKes = parsePositiveNumber(worldPrices?.WLD?.KES);
    const worldUsdcKes = parsePositiveNumber(worldPrices?.USDC?.KES);

    if (worldResponse.ok && worldWldKes > 1 && worldUsdcKes > 1) {
      sendJson(res, 200, {
        success: true,
        prices: {
          WLD: worldWldKes,
          USDC: worldUsdcKes,
        },
        source: "world-public-prices",
        fetchedAt: new Date().toISOString(),
      });
      return;
    }

    const response = await fetch(COINGECKO_PRICES_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json().catch(() => ({}));
    const coinGeckoRates = buildCoinGeckoRates(payload);

    if (!response.ok) {
      sendJson(res, response.status, {
        success: false,
        error: "Unable to load live prices from the market source.",
      });
      return;
    }

    if (coinGeckoRates.WLD <= 0 || coinGeckoRates.USDC <= 0) {
      sendJson(res, 502, {
        success: false,
        error: "Live crypto source returned an incomplete quote.",
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      prices: {
        WLD: coinGeckoRates.WLD,
        USDC: coinGeckoRates.USDC,
      },
      source: "coingecko-market-fallback",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load live prices.",
    });
  }
}
