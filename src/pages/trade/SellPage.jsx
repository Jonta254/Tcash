import { useEffect, useMemo, useState } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useOrderFlow } from "../../hooks/useOrderFlow";
import {
  APP_CONFIG,
  canUseWorldPay,
  formatCryptoAmount,
  formatKES,
  getCachedWorldWalletPortfolio,
  getCurrentUser,
  getWorldAppContext,
  getWorldWalletPortfolio,
  requestWorldPayment,
  syncOrderToAdminQueue,
  updateOrder,
} from "../../services";

function SellPage() {
  const settings = useAppSettings();
  const currentUser = getCurrentUser();
  const worldApp = getWorldAppContext();
  const [sendLoading, setSendLoading] = useState(false);
  const [orderCreating, setOrderCreating] = useState(false);
  const initialPortfolio = getCachedWorldWalletPortfolio(currentUser?.walletAddress);
  const [walletPortfolio, setWalletPortfolio] = useState(initialPortfolio);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const {
    asset,
    setAsset,
    cryptoAmount,
    setCryptoAmount,
    payoutPhoneNumber,
    setPayoutPhoneNumber,
    paymentReference,
    setPaymentReference,
    step,
    setStep,
    setCurrentOrder,
    currentOrder,
    error,
    setError,
    kesAmount,
    grossKesAmount,
    sellMinKesEquivalent,
    sellMinAssetAmount,
    placeOrder,
    markAsPaid,
    supportedAssets,
  } = useOrderFlow("sell");
  const canSendInsideMiniApp =
    worldApp.isInstalled &&
    canUseWorldPay(asset) &&
    Boolean(settings.sellWalletAddress?.trim());
  const selectedAssetBalance = useMemo(
    () => walletPortfolio.assets.find((entry) => entry.symbol === asset),
    [asset, walletPortfolio.assets],
  );

  useEffect(() => {
    if (!currentUser?.walletAddress) {
      return;
    }

    let active = true;
    setWalletLoading(true);
    setWalletError("");

    getWorldWalletPortfolio(currentUser.walletAddress)
      .then((portfolio) => {
        if (active) {
          setWalletPortfolio(portfolio);
        }
      })
      .catch((nextError) => {
        if (active) {
          const cachedPortfolio = getCachedWorldWalletPortfolio(currentUser.walletAddress);

          if (cachedPortfolio.assets.length) {
            setWalletPortfolio(cachedPortfolio);
            setWalletError("");
          } else {
            setWalletPortfolio({
              walletAddress: currentUser.walletAddress,
              assets: [],
              supported: true,
            });
            setWalletError("");
          }
        }
      })
      .finally(() => {
        if (active) {
          setWalletLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentUser?.walletAddress]);

  const handleMiniAppSend = async () => {
    if (!currentOrder) {
      return;
    }

    setError("");
    setSendLoading(true);

    try {
      const payment = await requestWorldPayment({
        amount: currentOrder.cryptoAmount,
        asset: currentOrder.asset,
        description: `TMpesa sell order ${currentOrder.id}`,
        to: settings.sellWalletAddress,
      });

      if (!payment.verified) {
        throw new Error(
          payment.transactionStatus
            ? `World payment is ${payment.transactionStatus}. Wait for confirmation and try again.`
            : "World payment could not be verified yet. Please try again.",
        );
      }

      const updated = updateOrder(
        currentOrder.id,
        {
          paymentMethod: "world-pay",
          paymentReference: payment.transactionId,
          paymentSummary: `World Pay verified (${payment.transactionStatus})`,
          paymentVerificationStatus: payment.transactionStatus,
          status: "paid",
        },
        null,
        { sync: false },
      );

      await syncOrderToAdminQueue(updated);

      setCurrentOrder(updated);
      setPaymentReference(payment.transactionId);
      setStep(3);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSendLoading(false);
    }
  };

  const handleCreateSellOrder = async () => {
    if (orderCreating) {
      return;
    }

    setOrderCreating(true);

    await placeOrder();
    setOrderCreating(false);
  };

  return (
    <div className="content-grid">
      <section className="panel stack task-panel">
        <div className="page-section-head">
          <div>
            <span className="brand-kicker">Sell WLD/USDC</span>
            <h2>Sell from World App and settle to M-Pesa</h2>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        {step === 1 ? (
          <div className="stack">
            {currentUser?.walletAddress || currentUser?.username ? (
              <div className="info-box receipt-card">
                <strong>M-Pesa payout number</strong>
                <span>KES will be sent to this number after review.</span>
                <code>{payoutPhoneNumber || currentUser?.mpesaPhoneNumber || "Add your payout number"}</code>
                {currentUser?.walletAddress ? <code>Wallet connected</code> : null}
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="asset">Asset</label>
              <select id="asset" value={asset} onChange={(event) => setAsset(event.target.value)}>
                {supportedAssets.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cryptoAmount">Amount of {asset}</label>
              <input
                id="cryptoAmount"
                type="number"
                min="0"
                step="0.01"
                value={cryptoAmount}
                onChange={(event) => setCryptoAmount(event.target.value)}
                placeholder="10"
              />
              <span className="muted field-hint">
                Minimum sell size:{" "}
                {sellMinAssetAmount
                  ? `${formatCryptoAmount(sellMinAssetAmount)} ${asset}`
                  : `live ${asset} equivalent`}
                .
              </span>
              {selectedAssetBalance ? (
                <div className="inline-payment-form">
                  <span className="muted field-hint">
                    Available now: {selectedAssetBalance.formattedBalance} {asset}
                  </span>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => setCryptoAmount(selectedAssetBalance.formattedBalance)}
                  >
                    Use max
                  </button>
                </div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="payoutPhoneNumber">M-Pesa payout number</label>
              <input
                id="payoutPhoneNumber"
                value={payoutPhoneNumber}
                onChange={(event) => setPayoutPhoneNumber(event.target.value)}
                placeholder="0712345678"
              />
            </div>

            <div className="amount-line">
              <span>You send</span>
              <strong>
                {cryptoAmount || "0"} {asset}
              </strong>
            </div>
            <div className="amount-line">
              <span>You will receive</span>
              <strong>{formatKES(kesAmount)}</strong>
            </div>

            {walletError ? <div className="error">{walletError}</div> : null}
            {walletLoading ? <div className="notice">Loading your sellable wallet balance...</div> : null}
            <div className="soft-note">TMpesa fee included. Manual review required.</div>

            {grossKesAmount < sellMinKesEquivalent && cryptoAmount ? (
              <div className="notice">
                Increase the sell amount to at least the live value of{" "}
                {APP_CONFIG.tradeLimits.sellMinUsdcEquivalent} USDC before creating this order.
              </div>
            ) : null}

            <button
              type="button"
              className="button"
              onClick={handleCreateSellOrder}
              disabled={orderCreating}
            >
              {orderCreating ? "Submitting order..." : "Review and Create Sell Order"}
            </button>
          </div>
        ) : null}

        {step >= 2 && currentOrder ? (
          <div className="stack">
            {canSendInsideMiniApp ? (
              <div className="highlight-box action-highlight">
                <strong>Send directly to TMpesa receiver</strong>
                <p className="muted">
                  Approve the World Pay sheet and the order will wait for manual M-Pesa settlement.
                </p>
              </div>
            ) : (
              <div className="highlight-box">
                <strong>Manual confirmation required</strong>
                <p className="muted">
                  If World Pay is unavailable, send manually and submit the blockchain transaction
                  hash.
                </p>
              </div>
            )}

            <div className="amount-line">
              <span>You send</span>
              <strong>
                {currentOrder.cryptoAmount} {currentOrder.asset}
              </strong>
            </div>
            <div className="amount-line">
              <span>You will receive</span>
              <strong>{formatKES(currentOrder.kesAmount)}</strong>
            </div>
            <div className="info-box receipt-card">
              <strong>M-Pesa payout number</strong>
              <code>{currentOrder.payoutPhoneNumber}</code>
            </div>

            {step === 2 ? (
              <>
                {canSendInsideMiniApp ? (
                  <button
                    type="button"
                    className="button"
                    onClick={handleMiniAppSend}
                    disabled={sendLoading}
                  >
                    {sendLoading ? "Opening World payment..." : `Send ${currentOrder.asset} to TMpesa`}
                  </button>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="txRef">Transaction hash</label>
                      <input
                        id="txRef"
                        value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                        placeholder="0x1234..."
                      />
                    </div>

                    <button
                      type="button"
                      className="button"
                      onClick={() => markAsPaid(paymentReference)}
                    >
                      I HAVE SENT
                    </button>
                  </>
                )}
              </>
            ) : null}

            {step === 3 ? (
              <div className="success-panel">
                <strong>Payment received for review</strong>
                <p>
                  Your wallet transfer is recorded. The admin will confirm the World payment and
                  send KES to <strong>{currentOrder.payoutPhoneNumber}</strong>.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default SellPage;
