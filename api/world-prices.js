import { allowMethods, sendJson } from "./_lib/http.js";

const WORLD_PRICES_URL =
  "https://app-backend.toolsforhumanity.com/public/v1/miniapps/prices?fiatCurrencies=KES&cryptoCurrencies=WLD,USDC";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    const response = await fetch(WORLD_PRICES_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      sendJson(res, response.status, {
        success: false,
        error: payload?.message || "Unable to load live prices from World.",
      });
      return;
    }

    const prices = payload?.result?.prices || {};

    sendJson(res, 200, {
      success: true,
      prices: {
        WLD: Number(prices?.WLD?.KES || 0),
        USDC: Number(prices?.USDC?.KES || 0),
      },
      source: "world-public-prices",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load live prices.",
    });
  }
}
