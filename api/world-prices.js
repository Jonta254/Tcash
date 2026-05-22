import { allowMethods, sendJson } from "./_lib/http.js";

const COINGECKO_PRICES_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=worldcoin-wld,usd-coin,tether&vs_currencies=kes,usd";

const WORLD_PRICES_URL =
  "https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?fiatCurrencies=KES&cryptoCurrencies=WLD,USDC";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const response = await fetch(COINGECKO_PRICES_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json().catch(() => ({}));

    const directWldKes = Number(payload?.["worldcoin-wld"]?.kes || 0);
    const wldUsd = Number(payload?.["worldcoin-wld"]?.usd || 0);
    const usdcKes = Number(payload?.["usd-coin"]?.kes || 0);
    const usdcUsd = Number(payload?.["usd-coin"]?.usd || 0);
    const usdtKes = Number(payload?.tether?.kes || 0);
    const usdtUsd = Number(payload?.tether?.usd || 0);
    const stableKesCandidates = [
      usdcKes > 1 && usdcUsd > 0 ? usdcKes / usdcUsd : 0,
      usdtKes > 1 && usdtUsd > 0 ? usdtKes / usdtUsd : 0,
    ].filter((value) => value > 0);
    const derivedKesPerUsd = stableKesCandidates.length
      ? stableKesCandidates.reduce((sum, value) => sum + value, 0) / stableKesCandidates.length
      : 0;
    const derivedWldKes = wldUsd > 0 && derivedKesPerUsd > 0 ? wldUsd * derivedKesPerUsd : 0;
    const wldKes =
      directWldKes > 1 &&
      derivedWldKes > 1 &&
      directWldKes / derivedWldKes > 0.65 &&
      directWldKes / derivedWldKes < 1.35
        ? directWldKes
        : derivedWldKes;

    if (response.ok && wldKes > 1 && usdcKes > 1) {
      sendJson(res, 200, {
        success: true,
        prices: {
          WLD: wldKes,
          USDC: usdcKes,
        },
        source: "coingecko-world-chain-live-prices",
        fetchedAt: new Date().toISOString(),
      });
      return;
    }

    const fallbackResponse = await fetch(WORLD_PRICES_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    const fallbackPayload = await fallbackResponse.json().catch(() => ({}));

    if (!fallbackResponse.ok) {
      sendJson(res, fallbackResponse.status, {
        success: false,
        error: fallbackPayload?.message || "Unable to load live prices from the market source.",
      });
      return;
    }

    const prices = fallbackPayload?.result?.prices || {};
    const fallbackWldKes = Number(prices?.WLD?.KES || 0);
    const fallbackUsdcKes = Number(prices?.USDC?.KES || 0);

    if (fallbackWldKes <= 0 || fallbackUsdcKes <= 0) {
      sendJson(res, 502, {
        success: false,
        error: "Live crypto source returned an incomplete quote.",
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      prices: {
        WLD: fallbackWldKes,
        USDC: fallbackUsdcKes,
      },
      source: "world-fallback-public-prices",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load live prices.",
    });
  }
}
