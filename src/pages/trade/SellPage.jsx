import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  haptic,
  requestWorldPayment,
  syncOrderToAdminQueue,
  updateOrder,
} from "../../services";

function SellPage() {
  const settings     = useAppSettings();
  const currentUser  = getCurrentUser();
  const worldApp     = getWorldAppContext();
  const navigate     = useNavigate();

  const [sendLoading,     setSendLoading]     = useState(false);
  const [orderCreating,   setOrderCreating]   = useState(false);
  const [orderJustPlaced, setOrderJustPlaced] = useState(false);
  const initialPortfolio = getCachedWorldWalletPortfolio(currentUser?.walletAddress);
  const [walletPortfolio, setWalletPortfolio] = useState(initialPortfolio);
  const [walletLoading,   setWalletLoading]   = useState(false);
  const [walletError,     setWalletError]     = useState("");

  const {
    asset, setAsset,
    cryptoAmount, setCryptoAmount,
    payoutPhoneNumber, setPayoutPhoneNumber,
    paymentReference, setPaymentReference,
    step, setStep,
    setCurrentOrder,
    currentOrder,
    error, setError,
    kesAmount,
    grossKesAmount,
    sellMinKesEquivalent,
    sellMinAssetAmount,
    placeOrder, markAsPaid,
    supportedAssets,
  } = useOrderFlow("sell");

  const canSendInsideMiniApp =
    worldApp.isInstalled &&
    canUseWorldPay(asset) &&
    Boolean(settings.sellWalletAddress?.trim());

  const selectedAssetBalance = useMemo(
    () => walletPortfolio.assets.find((e) => e.symbol === asset),
    [asset, walletPortfolio.assets],
  );

  useEffect(() => {
    if (!currentUser?.walletAddress) return;
    let active = true;
    setWalletLoading(true);
    setWalletError("");
    getWorldWalletPortfolio(currentUser.walletAddress)
      .then((p) => { if (active) setWalletPortfolio(p); })
      .catch(() => {
        if (active) {
          const c = getCachedWorldWalletPortfolio(currentUser.walletAddress);
          if (c.assets.length) setWalletPortfolio(c);
          else setWalletPortfolio({ walletAddress: currentUser.walletAddress, assets: [], supported: true });
        }
      })
      .finally(() => { if (active) setWalletLoading(false); });
    return () => { active = false; };
  }, [currentUser?.walletAddress]);

  const handleMiniAppSend = async () => {
    if (!currentOrder) return;
    setError(""); setSendLoading(true);
    try {
      const payment = await requestWorldPayment({
        amount:      currentOrder.cryptoAmount,
        asset:       currentOrder.asset,
        description: `TMpesa sell order ${currentOrder.id}`,
        to:          settings.sellWalletAddress,
      });
      // Only block if the payment definitively failed (not just pending/unindexed)
      const failedStatuses = ["failed", "reverted", "rejected"];
      if (failedStatuses.includes(payment.transactionStatus)) {
        throw new Error(`World payment ${payment.transactionStatus}. Please contact support.`);
      }
      const updated = updateOrder(
        currentOrder.id,
        {
          paymentMethod:             "world-pay",
          paymentReference:          payment.transactionId,
          paymentSummary:            `World Pay verified (${payment.transactionStatus})`,
          paymentVerificationStatus: payment.transactionStatus,
          status:                    "paid",
        },
        null,
        { sync: false },
      );
      // Crypto already left the user's wallet — never fail the flow on a
      // queue sync hiccup; the boot-time backfill re-syncs the paid order.
      await syncOrderToAdminQueue(updated).catch(() => null);
      setCurrentOrder(updated);
      setPaymentReference(payment.transactionId);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setSendLoading(false);
    }
  };

  const handleCreateSellOrder = async () => {
    if (orderCreating) return;
    haptic("medium");
    setOrderCreating(true);
    const order = await placeOrder();
    if (order) {
      haptic("success");
      setOrderJustPlaced(true);
    }
    setOrderCreating(false);
  };

  const resetFlow = () => {
    setStep(1); setCurrentOrder(null);
    setOrderJustPlaced(false); setError("");
    setCryptoAmount(""); setPaymentReference("");
  };

  /* ── STEP 1: Enter sell amount ────────────────────────────────── */
  if (step === 1) {
    return (
      <div className="content-grid">
        <section className="panel stack task-panel">
          <div className="page-section-head">
            <div>
              <span className="brand-kicker">Sell crypto</span>
              <h2>Sell WLD or USDC, receive M-Pesa</h2>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="stack">
            {(currentUser?.walletAddress || currentUser?.username) && (
              <div className="info-box receipt-card">
                <strong>M-Pesa payout number</strong>
                <span>KES is sent here after admin review.</span>
                <code>{payoutPhoneNumber || currentUser?.mpesaPhoneNumber || "Add your payout number"}</code>
                {currentUser?.walletAddress && <code>Wallet connected</code>}
              </div>
            )}

            <div className="field">
              <label htmlFor="sellAsset">Asset</label>
              <select id="sellAsset" value={asset} onChange={(e) => setAsset(e.target.value)}>
                {supportedAssets.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cryptoAmount">Amount of {asset} to sell</label>
              <input
                id="cryptoAmount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={cryptoAmount}
                onChange={(e) => setCryptoAmount(e.target.value)}
                placeholder="10"
              />
              <span className="muted field-hint">
                Minimum:{" "}
                {sellMinAssetAmount
                  ? `${formatCryptoAmount(sellMinAssetAmount)} ${asset}`
                  : `live ${asset} equivalent`}
              </span>
              {selectedAssetBalance && (
                <div className="inline-payment-form">
                  <span className="muted field-hint">
                    Available: {selectedAssetBalance.formattedBalance} {asset}
                  </span>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => setCryptoAmount(selectedAssetBalance.formattedBalance)}
                  >
                    Use max
                  </button>
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="payoutPhoneNumber">M-Pesa payout number</label>
              <input
                id="payoutPhoneNumber"
                value={payoutPhoneNumber}
                onChange={(e) => setPayoutPhoneNumber(e.target.value)}
                placeholder="0712345678"
              />
            </div>

            <div className="trade-summary-box">
              <div className="tsb-row">
                <span>You send</span>
                <strong>{cryptoAmount || "0"} {asset}</strong>
              </div>
              <div className="tsb-row tsb-row-receive">
                <span>You receive</span>
                <strong>{formatKES(kesAmount)}</strong>
              </div>
              <p className="tsb-note">TMpesa fee included · Manual review required</p>
            </div>

            {walletError  && <div className="error">{walletError}</div>}
            {walletLoading && <div className="notice">Loading wallet balance…</div>}

            {grossKesAmount < sellMinKesEquivalent && cryptoAmount && (
              <div className="notice">
                Increase the amount to at least the live value of{" "}
                {APP_CONFIG.tradeLimits.sellMinUsdcEquivalent} USDC.
              </div>
            )}

            <button
              type="button"
              className="button"
              onClick={handleCreateSellOrder}
              disabled={orderCreating}
            >
              {orderCreating ? "Placing order…" : "Confirm sell order"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ── STEP 3: Full success screen ──────────────────────────────── */
  if (step === 3 && currentOrder) {
    return (
      <div className="content-grid">
        <section className="panel stack task-panel">
          <div className="order-success-screen">
            <div className="oss-ring" aria-hidden="true">
              <span className="oss-check">✓</span>
            </div>
            <h2 className="oss-title">
              {canSendInsideMiniApp ? "Payment sent!" : "Order submitted!"}
            </h2>
            <p className="oss-body">
              Admin will confirm your payment and send{" "}
              <strong>{formatKES(currentOrder.kesAmount)}</strong> to{" "}
              <strong>{currentOrder.payoutPhoneNumber}</strong>.
            </p>
            <div className="oss-summary">
              <div className="oss-sum-row">
                <span>Order type</span>
                <strong>Sell {currentOrder.asset}</strong>
              </div>
              <div className="oss-sum-row">
                <span>You sent</span>
                <strong>{formatCryptoAmount(currentOrder.cryptoAmount)} {currentOrder.asset}</strong>
              </div>
              <div className="oss-sum-row">
                <span>KES payout</span>
                <strong>{formatKES(currentOrder.kesAmount)}</strong>
              </div>
              <div className="oss-sum-row">
                <span>M-Pesa to</span>
                <strong>{currentOrder.payoutPhoneNumber}</strong>
              </div>
            </div>
            <div className="oss-actions">
              <Link to="/orders" className="button">View in History</Link>
              <button type="button" className="button-ghost" onClick={resetFlow}>New trade</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ── STEP 2: Send crypto instructions ────────────────────────── */
  return (
    <div className="content-grid">
      <section className="panel stack task-panel">

        {/* Order placed banner */}
        {orderJustPlaced && currentOrder && (
          <div className="order-placed-banner">
            <span className="opb-check" aria-hidden="true">✓</span>
            <div className="opb-body">
              <strong>Order placed!</strong>
              <span>
                {formatCryptoAmount(currentOrder.cryptoAmount)} {currentOrder.asset} sell is saved.
              </span>
            </div>
            <Link to="/orders" className="opb-preview">Preview →</Link>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="page-section-head compact-page-head">
          <div>
            <span className="brand-kicker">Step 2 of 2</span>
            <h2>
              {canSendInsideMiniApp
                ? "Send crypto via World Pay"
                : "Send crypto manually"}
            </h2>
          </div>
        </div>

        <div className="stack">
          <div className="trade-summary-box">
            <div className="tsb-row">
              <span>You send</span>
              <strong>{currentOrder.cryptoAmount} {currentOrder.asset}</strong>
            </div>
            <div className="tsb-row tsb-row-receive">
              <span>You receive</span>
              <strong>{formatKES(currentOrder.kesAmount)}</strong>
            </div>
          </div>

          <div className="info-box receipt-card">
            <strong>M-Pesa payout number</strong>
            <code>{currentOrder.payoutPhoneNumber}</code>
          </div>

          {canSendInsideMiniApp ? (
            <>
              <div className="highlight-box action-highlight">
                <strong>Send directly inside World App</strong>
                <p className="muted">
                  Approve the World Pay sheet — your KES payout begins after manual review.
                </p>
              </div>
              <button
                type="button"
                className="button"
                onClick={handleMiniAppSend}
                disabled={sendLoading}
              >
                {sendLoading
                  ? "Opening World payment…"
                  : `Send ${currentOrder.cryptoAmount} ${currentOrder.asset} to TMpesa`}
              </button>
            </>
          ) : (
            <>
              <div className="highlight-box">
                <strong>Send manually then confirm</strong>
                <p className="muted">
                  Transfer crypto to the TMpesa wallet and paste the blockchain transaction hash.
                </p>
              </div>
              <div className="field">
                <label htmlFor="txRef">Transaction hash</label>
                <input
                  id="txRef"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="0x1234…"
                />
              </div>
              <button
                type="button"
                className="button"
                onClick={() => markAsPaid(paymentReference)}
              >
                I have sent — submit hash
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default SellPage;
