export async function fetchWorldMarketRates() {
  const response = await fetch("/api/world-prices").catch(() => {
    throw new Error("TMpesa could not load live market prices.");
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "TMpesa could not load live market prices.");
  }

  const wldRate = Number(payload?.prices?.WLD || 0);
  const usdcRate = Number(payload?.prices?.USDC || 0);

  if (wldRate <= 0 || usdcRate <= 0) {
    throw new Error("TMpesa received an incomplete live market quote.");
  }

  return {
    rates: {
      WLD: wldRate,
      USDC: usdcRate,
    },
    source: payload?.source || "world-official-public-prices",
    fetchedAt: payload?.fetchedAt || null,
  };
}
