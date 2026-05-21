import { useEffect, useMemo, useState } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useOrderFlow } from "../../hooks/useOrderFlow";
import {
  APP_CONFIG,
  canUseWorldPay,
  formatCryptoAmount,
  formatKES,
  getCurrentUser,
  getWorldAppContext,
  getWorldWalletPortfolio,
  isUserAccessVerified,
  openWhatsAppSupport,
  openSupportEmail,
  requestWorldPayment,
  requestWorldVerification,
  updateOrder,
} from "../../services";

function SellPage() {
  const settings = useAppSettings();
  const currentUser = getCurrentUser();
  const worldApp = getWorldAppContext();
  const [sendLoading, setSendLoading] = useState(false);
  const [walletPortfolio, setWalletPortfolio] = useState({ assets: [] });
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
    setCurrentOrder,
    currentOrder,
    error,
    setError,
    kesAmount,
    grossKesAmount,
    sellRateKes,
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
  const needsOrderVerification =
    kesAmount >= APP_CONFIG.highValueOrderKesThreshold &&
    worldApp.isInstalled &&
    !isUserAccessVerified(currentUser);
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
      .catch((error) => {
        if (active) {
          setWalletError(error instanceof Error ? error.message : "Unable to load your World wallet.");
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

      const updated = updateOrder(currentOrder.id, {
        paymentMethod: "world-pay",
        paymentReference: payment.transactionId,
        paymentSummary: payment.verified
          ? `World Pay verified (${payment.transactionStatus})`
          : `World Pay submitted (${payment.transactionStatus})`,
        paymentVerificationStatus: payment.transactionStatus,
        status: "paid",
      });

      setCurrentOrder(updated);
      markAsPaid(payment.transactionId);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSendLoading(false);
    }
  };

  const handleCreateSellOrder = async () => {
    if (needsOrderVerification) {
      try {
        setError("");
        const verification = await requestWorldVerification({
          action: APP_CONFIG.highValueOrderAction,
          signal: `sell:${asset}:${cryptoAmount}:${kesAmount}`,
          verificationLevel: "device",
        });
        placeOrder({
          humanVerificationStatus: "verified",
          humanVerificationLevel: verification.verificationLevel,
        });
        return;
      } catch (nextError) {
        setError(nextError.message);
        return;
      }
    }

    placeOrder();
  };

  return (
    <div className="content-grid">
      <section className="panel stack task-panel">
        <div className="page-section-head">
          <div>
            <span className="brand-kicker">Sell WLD/USDC</span>
            <h2>Sell from World App and settle to M-Pesa</h2>
            <p className="muted">Enter the crypto amount, approve the transfer, then receive KES after review.</p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Live rate</span>
              <strong>{formatKES(sellRateKes)}</strong>
            </div>
            <div>
              <span>Asset</span>
              <strong>{asset}</strong>
            </div>
            <div>
              <span>Available</span>
              <strong>
                {selectedAssetBalance ? `${selectedAssetBalance.formattedBalance} ${asset}` : "Syncing"}
              </strong>
            </div>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        {step === 1 ? (
          <div className="stack">
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
                Minimum sell size: {sellMinAssetAmount ? `${formatCryptoAmount(sellMinAssetAmount)} ${asset}` : `live ${asset} equivalent`}.
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
              <span className="muted field-hint">
                This is where the admin will send KES after your World payment is confirmed.
              </span>
            </div>

            <div className="amount-line">
              <span>Rate</span>
              <strong>{formatKES(sellRateKes)}</strong>
            </div>
            <div className="amount-line">
              <span>You send</span>
              <strong>{cryptoAmount || "0"} {asset}</strong>
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
                Increase the sell amount to at least the live value of 3 USDC before creating this order.
              </div>
            ) : null}
            {needsOrderVerification ? (
              <div className="notice">
                This order is above KES {APP_CONFIG.highValueOrderKesThreshold.toLocaleString()}.
                TMpesa will ask for a World human check before creating it.
              </div>
            ) : kesAmount >= APP_CONFIG.highValueOrderKesThreshold ? (
              <div className="notice">
                Your World account is already verified, so TMpesa will create this high-value order
                without asking for another human check.
              </div>
            ) : null}

            <button type="button" className="button" onClick={handleCreateSellOrder}>
              Review and Create Sell Order
            </button>
          </div>
        ) : null}

        {step >= 2 && currentOrder ? (
          <div className="stack">
            {canSendInsideMiniApp ? (
              <div className="highlight-box action-highlight">
                <strong>Step 2: Send directly to TMpesa receiver</strong>
                <p className="muted">
                  Tap send and approve the World Pay sheet. The asset goes straight from the user
                  wallet to your connected TMpesa Worldchain receiver, then the order waits for
                  admin payout review.
                </p>
              </div>
            ) : (
              <div className="highlight-box">
                <strong>Manual confirmation required</strong>
                <p className="muted">
                  Open TMpesa inside World App for direct wallet payment. If the World Pay sheet is
                  unavailable, send manually and submit the blockchain transaction hash.
                </p>
              </div>
            )}

            <div className="amount-line">
              <span>You send</span>
              <strong>{currentOrder.cryptoAmount} {currentOrder.asset}</strong>
            </div>
            <div className="amount-line">
              <span>You will receive</span>
              <strong>{formatKES(currentOrder.kesAmount)}</strong>
            </div>
            <div className="soft-note">TMpesa fee included.</div>
            <div className="info-box receipt-card">
              <strong>M-Pesa payout destination</strong>
              <span>This number is used when the admin sends your KES settlement.</span>
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
                      <label htmlFor="txRef">Transaction Hash (txRef)</label>
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
                  send KES to <strong>{currentOrder.payoutPhoneNumber}</strong> while the order
                  remains in payout review.
                </p>
                <p>
                  You can track the status from the Orders tab and use the support actions if your
                  payout takes longer than expected.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <aside className="summary-card stack guide-panel">
        <h3>Sell guide</h3>
        <div className="flow-list">
          <div><span>1</span><p>Choose the asset and amount you want to sell.</p></div>
          <div><span>2</span><p>Confirm the M-Pesa number that should receive your KES.</p></div>
          <div><span>3</span><p>Approve the transfer or submit the blockchain transaction hash.</p></div>
          <div><span>4</span><p>Track the order until payout is completed.</p></div>
        </div>
        <div className="soft-note">TMpesa fee included. Manual review required.</div>
        <div className="support-card">
          <strong>Need help?</strong>
          <p className="muted">Use Gmail for support questions or WhatsApp for delayed payout follow-up.</p>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              openSupportEmail({
                subject: "TMpesa sell support",
                body: "Hello TMpesa team,\n\nI need help with my sell flow.",
              })
            }
          >
            Support
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() =>
              openWhatsAppSupport({
                message: "Hello TMpesa team,\n\nMy sell payout seems delayed. Please assist.",
              })
            }
          >
            Delay on WhatsApp
          </button>
        </div>
      </aside>
    </div>
  );
}

export default SellPage;
