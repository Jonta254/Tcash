export async function fetchWorldMarketRates() {
  const response = await fetch("/api/world-prices").catch(() => {
    throw new Error("TMpesa could not load live market prices.");
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "TMpesa could not load live market prices.");
  }

  return {
    rates: {
      WLD: Number(payload?.prices?.WLD || 0),
      USDC: Number(payload?.prices?.USDC || 0),
    },
    source: payload?.source || "world-public-prices",
    fetchedAt: payload?.fetchedAt || null,
  };
}
