import { useMemo, useState } from "react";
import { APP_CONFIG, createOrder, getCurrentUser, updateCurrentUserProfile, updateOrder } from "../services";
import { useAppSettings } from "./useAppSettings";
import { useExchangeRate } from "./useExchangeRate";

export function useOrderFlow(type, initialAsset = "WLD") {
  const currentUser = getCurrentUser();
  const settings = useAppSettings();
  const [asset, setAsset] = useState(initialAsset);
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState(() => currentUser?.walletAddress || "");
  const [payoutPhoneNumber, setPayoutPhoneNumber] = useState(
    () => currentUser?.mpesaPhoneNumber || currentUser?.phone || "",
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [step, setStep] = useState(1);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [error, setError] = useState("");
  const exchangeRate = useExchangeRate(asset);
  const usdcExchangeRate = useExchangeRate("USDC");
  const feePerCoinKes = Number(settings.feeKesPerCoin?.[asset] || 0);

  const grossKesAmount = useMemo(() => {
    const parsedAmount = Number(cryptoAmount);
    if (!parsedAmount || parsedAmount < 0) {
      return 0;
    }

    return parsedAmount * exchangeRate;
  }, [cryptoAmount, exchangeRate]);

  const feeKesAmount = useMemo(() => {
    const parsedAmount = Number(cryptoAmount);
    if (!parsedAmount || parsedAmount < 0) {
      return 0;
    }

    return parsedAmount * feePerCoinKes;
  }, [cryptoAmount, feePerCoinKes]);

  const kesAmount = useMemo(() => {
    if (type === "sell") {
      return Math.max(grossKesAmount - feeKesAmount, 0);
    }

    return grossKesAmount + feeKesAmount;
  }, [feeKesAmount, grossKesAmount, type]);

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

  const placeOrder = (options = {}) => {
    setError("");

    if (!cryptoAmount || Number(cryptoAmount) <= 0) {
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

    if (type === "sell" && !payoutPhoneNumber.trim()) {
      setError("Enter the M-Pesa phone number that should receive your KES payout.");
      return null;
    }

    if (type === "sell" && payoutPhoneNumber.trim() !== (currentUser?.mpesaPhoneNumber || "")) {
      updateCurrentUserProfile({ mpesaPhoneNumber: payoutPhoneNumber.trim() });
    }

    const order = createOrder({
      type,
      asset,
      cryptoAmount,
      kesAmount,
      grossKesAmount,
      feeKesAmount,
      feePerCoinKes,
      walletAddress: walletAddress.trim(),
      payoutPhoneNumber: payoutPhoneNumber.trim(),
      destinationUsername: currentUser?.username || "",
      humanVerificationStatus: options.humanVerificationStatus || "",
      humanVerificationLevel: options.humanVerificationLevel || "",
    });

    setCurrentOrder(order);
    setStep(2);
    return order;
  };

  const markAsPaid = (nextReference) => {
    setError("");

    if (!nextReference.trim()) {
      setError(
        type === "sell"
          ? "Enter the blockchain transaction hash before continuing."
          : "Enter the M-Pesa transaction code before submitting.",
      );
      return null;
    }

    const formattedReference =
      type === "buy" ? nextReference.trim().toUpperCase() : nextReference.trim();
    const updated = updateOrder(currentOrder.id, {
      paymentReference: formattedReference,
      status: "paid",
    });

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
