import { normalizeKenyanPhone, validMpesaCode } from "../services/tradeValidation";
import { useMemo, useState } from "react";
import {
  APP_CONFIG,
  buildDraftOrder,
  calculateBuyRate,
  calculateSellRate,
  commitPaidOrder,
  getCurrentUser,
  updateCurrentUserProfile,
  syncOrderToAdminQueue,
  mergeAdminOrders,
  getOrdersForCurrentUser,
} from "../services";
import { useAppSettings } from "./useAppSettings";
import { useExchangeRate } from "./useExchangeRate";

export function useOrderFlow(type, initialAsset = "WLD") {
  const currentUser = getCurrentUser();
  const settings = useAppSettings();
  const resumeId = new URLSearchParams(window.location.search).get("order");
  const resumed = getOrdersForCurrentUser().find(order => order.id === resumeId && order.type === type && ["pending", "paid"].includes(order.status));
  const [asset, setAsset] = useState(resumed?.asset || initialAsset);
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [buyKesInput, setBuyKesInput] = useState("");
  const [walletAddress, setWalletAddress] = useState(() => currentUser?.walletAddress || "");
  const [payoutPhoneNumber, setPayoutPhoneNumber] = useState(
    () => currentUser?.mpesaPhoneNumber || currentUser?.phone || "",
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [step, setStep] = useState(resumed ? (resumed.status === "paid" ? 3 : 2) : 1);
  const [currentOrder, setCurrentOrder] = useState(resumed || null);
  const [error, setError] = useState("");
  const exchangeRate = useExchangeRate(asset);
  const usdcExchangeRate = useExchangeRate("USDC");
  const feePerCoinKes = Number(settings.feeKesPerCoin?.[asset] || 0);

  const parsedSellAmount = Number(cryptoAmount);
  const parsedBuyKesAmount = Number(buyKesInput);

  const quotedCryptoAmount = useMemo(() => {
    if (type !== "buy") {
      return parsedSellAmount > 0 ? parsedSellAmount : 0;
    }

    if (!parsedBuyKesAmount || parsedBuyKesAmount < 0) {
      return 0;
    }

    const effectiveRate = exchangeRate + feePerCoinKes;
    if (!effectiveRate || effectiveRate <= 0) {
      return 0;
    }

    return parsedBuyKesAmount / effectiveRate;
  }, [exchangeRate, feePerCoinKes, parsedBuyKesAmount, parsedSellAmount, type]);

  const buyRateKes = useMemo(
    () => calculateBuyRate(exchangeRate, feePerCoinKes),
    [exchangeRate, feePerCoinKes],
  );
  const sellRateKes = useMemo(
    () => calculateSellRate(exchangeRate, feePerCoinKes),
    [exchangeRate, feePerCoinKes],
  );

  const grossKesAmount = useMemo(() => {
    if (type === "buy") {
      return quotedCryptoAmount * exchangeRate;
    }

    if (!parsedSellAmount || parsedSellAmount < 0) {
      return 0;
    }

    return parsedSellAmount * exchangeRate;
  }, [exchangeRate, parsedSellAmount, quotedCryptoAmount, type]);

  const feeKesAmount = useMemo(() => {
    if (type === "buy") {
      return quotedCryptoAmount * feePerCoinKes;
    }

    if (!parsedSellAmount || parsedSellAmount < 0) {
      return 0;
    }

    return parsedSellAmount * feePerCoinKes;
  }, [feePerCoinKes, parsedSellAmount, quotedCryptoAmount, type]);

  const kesAmount = useMemo(() => {
    if (type === "sell") {
      return Math.max(grossKesAmount - feeKesAmount, 0);
    }

    return parsedBuyKesAmount > 0 ? parsedBuyKesAmount : grossKesAmount + feeKesAmount;
  }, [feeKesAmount, grossKesAmount, parsedBuyKesAmount, type]);

  const buyKesMin = APP_CONFIG.tradeLimits.buyKesMin;
  const buyKesMax = APP_CONFIG.tradeLimits.buyKesMax;
  const sellMinKesEquivalent = useMemo(() => {
    const baseRate = Number(usdcExchangeRate || exchangeRate || 0);

    if (!baseRate || baseRate <= 0) {
      return 0;
    }

    return APP_CONFIG.tradeLimits.sellMinUsdcEquivalent * baseRate;
  }, [exchangeRate, usdcExchangeRate]);

  const sellMinAssetAmount = useMemo(() => {
    if (!exchangeRate || exchangeRate <= 0 || !sellMinKesEquivalent) {
      return 0;
    }

    return sellMinKesEquivalent / exchangeRate;
  }, [exchangeRate, sellMinKesEquivalent]);

  const placeOrder = async () => {
    setError("");

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || !Number.isFinite(quotedCryptoAmount) || !Number.isFinite(kesAmount) || kesAmount <= 0) {
      setError("A valid market quote is unavailable. Refresh the rates before continuing.");
      return null;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Reconnect to the internet before starting a payment.");
      return null;
    }
    if (type === "buy" && (!buyKesInput || parsedBuyKesAmount <= 0)) {
      setError("Enter a valid KES amount before placing your order.");
      return null;
    }

    if (type === "sell" && (!cryptoAmount || parsedSellAmount <= 0)) {
      setError("Enter a valid crypto amount before placing your order.");
      return null;
    }

    if (type === "buy" && (kesAmount < buyKesMin || kesAmount > buyKesMax)) {
      setError(`Buy orders must stay between KES ${buyKesMin.toLocaleString()} and KES ${buyKesMax.toLocaleString()} at the live rate.`);
      return null;
    }

    if (type === "sell" && grossKesAmount < sellMinKesEquivalent) {
      const minimumAsset = sellMinAssetAmount ? `${sellMinAssetAmount.toFixed(4)} ${asset}` : `the ${asset} amount equivalent`;
      setError(
        `Sell orders must be at least ${APP_CONFIG.tradeLimits.sellMinUsdcEquivalent} USDC equivalent at the live rate. Enter ${minimumAsset} or more.`,
      );
      return null;
    }

    if (type === "buy" && !walletAddress.trim() && !currentUser?.username) {
      setError("Open with World App or enter the wallet address that should receive the crypto.");
      return null;
    }

    if (type === "sell" && !normalizeKenyanPhone(payoutPhoneNumber)) {
      setError("Enter a Kenyan M-Pesa number, such as 0712345678 or +254712345678.");
      return null;
    }

    if (type === "sell" && payoutPhoneNumber.trim() !== (currentUser?.mpesaPhoneNumber || "")) {
      updateCurrentUserProfile({ mpesaPhoneNumber: payoutPhoneNumber.trim() });
    }

    try {
      // Reserve a server-priced pending order before revealing payment details.
      const order = buildDraftOrder({
        type,
        asset,
        cryptoAmount: quotedCryptoAmount,
        kesAmount,
        grossKesAmount,
        feeKesAmount,
        feePerCoinKes,
        walletAddress: walletAddress.trim(),
        payoutPhoneNumber: normalizeKenyanPhone(payoutPhoneNumber) || "",
        destinationUsername: currentUser?.username || "",
      });

      const result = await syncOrderToAdminQueue(order, { notifyAdmin: false });
      const saved = result.orders?.find(entry => entry.id === order.id);
      if (!saved) throw new Error("The order desk did not return a saved quote. Try again before paying.");
      mergeAdminOrders([saved]);
      setCurrentOrder(saved);
      setStep(2);
      return saved;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Tcash could not start this order. Please try again.",
      );
      return null;
    }
  };

  const markAsPaid = async (nextReference) => {
    setError("");

    if (!currentOrder) {
      setError("Start your order again — the draft was lost.");
      return null;
    }

    if (!nextReference.trim()) {
      setError(
        type === "sell"
          ? "Enter the blockchain transaction hash before continuing."
          : "Enter the M-Pesa transaction code before submitting.",
      );
      return null;
    }

    if (type === "buy" && !validMpesaCode(nextReference)) {
      setError("Enter the 10-character transaction code from your M-Pesa confirmation SMS.");
      return null;
    }
    if (type === "sell" && !/^0x[a-fA-F0-9]{64}$/.test(nextReference.trim())) {
      setError("Enter the complete blockchain transaction hash (0x followed by 64 characters).");
      return null;
    }
    const formattedReference =
      type === "buy" ? nextReference.trim().toUpperCase() : nextReference.trim();

    // Acknowledge only after durable server acceptance. Keep this same order on retry.
    let updated;
    try {
      updated = await commitPaidOrder(currentOrder, {
        paymentReference: formattedReference,
        status: "paid",
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Tcash could not record this payment. Please contact support before retrying.",
      );
      return null;
    }

    setPaymentReference(formattedReference);
    setCurrentOrder(updated);
    setStep(3);
    return updated;
  };

  return {
    asset,
    setAsset,
    cryptoAmount,
    setCryptoAmount,
    buyKesInput,
    setBuyKesInput,
    quotedCryptoAmount,
    walletAddress,
    setWalletAddress,
    payoutPhoneNumber,
    setPayoutPhoneNumber,
    paymentReference,
    setPaymentReference,
    step,
    setStep,
    currentOrder,
    setCurrentOrder,
    error,
    setError,
    kesAmount,
    grossKesAmount,
    feeKesAmount,
    feePerCoinKes,
    buyRateKes,
    sellRateKes,
    buyKesMin,
    buyKesMax,
    sellMinKesEquivalent,
    sellMinAssetAmount,
    exchangeRate,
    placeOrder,
    markAsPaid,
    supportedAssets: APP_CONFIG.supportedAssets,
  };
}
