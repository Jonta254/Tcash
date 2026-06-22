import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useOrderFlow } from "../../hooks/useOrderFlow";
import { formatCryptoAmount, formatKES, getCurrentUser, haptic } from "../../services";

function BuyPage() {
  const settings     = useAppSettings();
  const currentUser  = getCurrentUser();
  const navigate     = useNavigate();
  const [copiedValue,    setCopiedValue]    = useState("");
  const [orderCreating,  setOrderCreating]  = useState(false);
  const [orderJustPlaced, setOrderJustPlaced] = useState(false);

  const {
    asset, setAsset,
    buyKesInput, setBuyKesInput,
    quotedCryptoAmount,
    walletAddress, setWalletAddress,
    paymentReference, setPaymentReference,
    step, setStep,
    setCurrentOrder,
    currentOrder,
    error, setError,
    kesAmount,
    buyKesMin, buyKesMax,
    placeOrder, markAsPaid,
    supportedAssets,
  } = useOrderFlow("buy");

  const handleCreateBuyOrder = async () => {
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
    setStep(1);
    setCurrentOrder(null);
    setOrderJustPlaced(false);
    setError("");
    setBuyKesInput("");
    setPaymentReference("");
  };

  const copyValue = async (label, value) => {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      haptic("light");
      setCopiedValue(label);
      window.setTimeout(() => setCopiedValue(""), 1800);
    } catch {
      setError(`Copy failed — long-press ${label} to copy manually.`);
    }
  };

  /* ── STEP 1: Enter amount ─────────────────────────────────────── */
  if (step === 1) {
    return (
      <div className="content-grid">
        <section className="panel stack task-panel">
          {error && <div className="error">{error}</div>}

          <div className="stack">
            {(currentUser?.walletAddress || currentUser?.username) && (
              <div className="info-box receipt-card">
                <strong>Delivery destination</strong>
                <span>Crypto is sent here after admin review.</span>
                {currentUser?.username    && <code>@{currentUser.username}</code>}
                {currentUser?.walletAddress && <code>Wallet connected</code>}
              </div>
            )}

            <div className="field">
              <label htmlFor="buyAsset">Asset</label>
              <select id="buyAsset" value={asset} onChange={(e) => setAsset(e.target.value)}>
                {supportedAssets.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="buyAmountKes">Amount to pay (KES)</label>
              <input
                id="buyAmountKes"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={buyKesInput}
                onChange={(e) => setBuyKesInput(e.target.value)}
                placeholder="600"
              />
              <span className="muted field-hint">
                Limits: {formatKES(buyKesMin)} – {formatKES(buyKesMax)}
              </span>
            </div>

            {!currentUser?.walletAddress && !currentUser?.username && (
              <div className="field">
                <label htmlFor="walletAddress">Destination wallet address</label>
                <input
                  id="walletAddress"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0xYourWalletAddress"
                />
              </div>
            )}

            <div className="trade-summary-box">
              <div className="tsb-row">
                <span>You pay</span>
                <strong>{formatKES(kesAmount)}</strong>
              </div>
              <div className="tsb-row tsb-row-receive">
                <span>You receive</span>
                <strong>{quotedCryptoAmount ? `${formatCryptoAmount(quotedCryptoAmount)} ${asset}` : `0 ${asset}`}</strong>
              </div>
              <p className="tsb-note">TMpesa fee included · Manual review required</p>
            </div>

            {(kesAmount < buyKesMin || kesAmount > buyKesMax) && buyKesInput && (
              <div className="notice">
                Adjust so the total stays between {formatKES(buyKesMin)} and {formatKES(buyKesMax)}.
              </div>
            )}

            <button
              type="button"
              className="button"
              onClick={handleCreateBuyOrder}
              disabled={orderCreating}
            >
              {orderCreating ? "Placing order…" : "Confirm buy order"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ── STEP 3: Payment submitted — full success screen ──────────── */
  if (step === 3 && currentOrder) {
    return (
      <div className="content-grid">
        <section className="panel stack task-panel">
          <div className="order-success-screen">
            <div className="oss-ring" aria-hidden="true">
              <span className="oss-check">✓</span>
            </div>
            <h2 className="oss-title">Payment submitted!</h2>
            <p className="oss-body">
              Admin will verify your M-Pesa payment and release{" "}
              <strong>{formatCryptoAmount(currentOrder.cryptoAmount)} {currentOrder.asset}</strong>{" "}
              to your wallet.
            </p>
            <div className="oss-summary">
              <div className="oss-sum-row">
                <span>Order type</span>
                <strong>Buy {currentOrder.asset}</strong>
              </div>
              <div className="oss-sum-row">
                <span>You paid</span>
                <strong>{formatKES(currentOrder.kesAmount)}</strong>
              </div>
              <div className="oss-sum-row">
                <span>You receive</span>
                <strong>{formatCryptoAmount(currentOrder.cryptoAmount)} {currentOrder.asset}</strong>
              </div>
              {currentOrder.paymentReference && (
                <div className="oss-sum-row">
                  <span>M-Pesa code</span>
                  <strong>{currentOrder.paymentReference}</strong>
                </div>
              )}
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

  /* ── STEP 2: Payment instructions ────────────────────────────── */
  return (
    <div className="content-grid">
      <section className="panel stack task-panel">

        {/* Order placed banner */}
        {orderJustPlaced && currentOrder && (
          <div className="order-placed-banner">
            <span className="opb-check" aria-hidden="true">→</span>
            <div className="opb-body">
              <strong>One step left</strong>
              <span>
                Pay via M-Pesa below and submit the code to confirm — the order is saved only once you do.
              </span>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="page-section-head compact-page-head">
          <div>
            <span className="brand-kicker">Step 2 of 2</span>
            <h2>Complete your M-Pesa payment</h2>
          </div>
        </div>

        <div className="stack">
          <div className="payment-card payment-instructions-card">
            <span className="pic-label">Pay via M-Pesa PayBill</span>
            <strong className="pic-amount">{formatKES(currentOrder.kesAmount)}</strong>

            <div className="copy-detail-list">
              {[
                { label: "PayBill", value: settings.mpesaPaybillNumber },
                { label: "Account", value: settings.mpesaAccountNumber },
                { label: "Name",    value: settings.mpesaTillName },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span>{label}</span>
                  <code>{value}</code>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => copyValue(label, value)}
                  >
                    {copiedValue === label ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
            <p className="pic-note">Pay on M-Pesa, then paste the confirmation code below.</p>
          </div>

          <div className="info-box receipt-card">
            <strong>Crypto delivery destination</strong>
            {currentOrder.destinationUsername && <code>@{currentOrder.destinationUsername}</code>}
            {currentOrder.walletAddress        && <code>Wallet connected</code>}
          </div>

          <div className="field">
            <label htmlFor="mpesaCode">M-Pesa transaction code</label>
            <input
              id="mpesaCode"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="QWE123XYZ"
            />
          </div>

          <button
            type="button"
            className="button"
            onClick={() => markAsPaid(paymentReference)}
          >
            I have paid — submit code
          </button>
        </div>
      </section>
    </div>
  );
}

export default BuyPage;
