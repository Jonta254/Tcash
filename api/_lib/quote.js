export function priceOrder(order, market, settings = {}) {
  const rate = Number(market.prices[order.asset]);
  const fee = Number(settings.feeKesPerCoin?.[order.asset] ?? 10);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(fee) || fee < 0 || (order.type === "sell" && fee >= rate)) throw new Error("A valid quote is unavailable. Contact support before paying.");
  const cents = n => Math.round(n * 100) / 100;
  const amount = order.type === "buy" ? Math.floor(Number(order.kesAmount) / (rate + fee) * 1e6) / 1e6 : Number(order.cryptoAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive trade amount.");
  if (order.type === "sell" && amount * rate < Number(market.prices.USDC)) throw new Error("Sell orders must be at least 1 USDC equivalent.");
  const gross = cents(amount * rate);
  const feeTotal = cents(amount * fee);
  return { ...order, cryptoAmount: amount, grossKesAmount: gross, feeKesAmount: feeTotal, feePerCoinKes: fee,
    kesAmount: order.type === "buy" ? cents(Number(order.kesAmount)) : cents(gross - feeTotal),
    quoteSource: market.source, quotedAt: market.fetchedAt,
    sellWalletAddress: settings.sellWalletAddress || "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc",
    mpesaPaybillNumber: settings.mpesaPaybillNumber || "542542", mpesaAccountNumber: settings.mpesaAccountNumber || "856340", mpesaTillName: settings.mpesaTillName || "B.O.J" };
}
