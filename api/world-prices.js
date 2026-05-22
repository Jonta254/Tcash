import { allowMethods, sendJson } from "./_lib/http.js";

const COINGECKO_PRICES_URL =
  "https://api.coingecko.com/api/v3/simple/token_price/world-chain?contract_addresses=0x2cfc85d8e48f8eab294be644d9e25c3030863003,0x79A02482A880bCE3F13e09Da970dC34db4CD24d1&vs_currencies=kes";

const WORLD_PRICES_URL =
  "https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?fiatCurrencies=KES&cryptoCurrencies=WLD,USDC";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    const response = await fetch(COINGECKO_PRICES_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json().catch(() => ({}));

    const wldKes = Number(
      payload?.["0x2cfc85d8e48f8eab294be644d9e25c3030863003"]?.kes || 0,
    );
    const usdcKes = Number(
      payload?.["0x79a02482a880bce3f13e09da970dc34db4cd24d1"]?.kes ||
        payload?.["0x79A02482A880bCE3F13e09Da970dC34db4CD24d1"]?.kes ||
        0,
    );

    if (response.ok && wldKes > 0 && usdcKes > 0) {
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
