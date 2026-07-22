import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../components/icons/Icon";
import AmountField from "../../components/interaction/AmountField";
import HoldToConfirm from "../../components/interaction/HoldToConfirm";
import Receipt from "../../components/receipt/Receipt";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useOrderFlow } from "../../hooks/useOrderFlow";
import { useHighValueVerification } from "../../hooks/useHighValueVerification";
import { formatCryptoAmount, formatKES, getCurrentUser, haptic, tenderHaptics } from "../../services";

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

  const {
    ensureVerified,
    starting: verifyStarting,
    error: verifyError,
    widget: worldIdWidget,
  } = useHighValueVerification({ wallet: currentUser?.walletAddress || walletAddress });

  const handleCreateBuyOrder = async () => {
    if (orderCreating || verifyStarting) return;
    haptic("medium");
    // High-value orders must clear a one-time World ID check before the
    // payment step — ensureVerified runs the order creation only once the
    // wallet is verified (or immediately when no check is needed).
    await ensureVerified(kesAmount, async () => {
      setOrderCreating(true);
      const order = await placeOrder();
      if (order) {
        tenderHaptics.commit();
        setOrderJustPlaced(true);
      }
      setOrderCreating(false);
    });
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
        <section className="panel stack task-panel trade-panel-compact">
          {error && <div className="error">{error}</div>}
          {verifyError && <div className="error">{verifyError}</div>}
          {worldIdWidget}

          {(currentUser?.walletAddress || currentUser?.username) && (
            <div className="trade-dest-strip">
              <span className="tds-icon" aria-hidden="true"><Icon name="arrowDown" size={16} strokeWidth={2.1} /></span>
              <div className="tds-text">
                <strong>{currentUser?.username ? `@${currentUser.username}` : "Wallet connected"}</strong>
                <span>Crypto delivered here after admin review</span>
              </div>
            </div>
          )}

          <AmountField
            id="buyAmountKes"
            label="Amount to pay"
            value={buyKesInput}
            onChange={setBuyKesInput}
            placeholder="600"
            suffix="KES"
          />

          <div className="field">
            <label htmlFor="buyAsset">Asset</label>
            <select id="buyAsset" value={asset} onChange={(e) => setAsset(e.target.value)}>
              {supportedAssets.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <span className="muted field-hint trade-limits-hint">
            Limits: {formatKES(buyKesMin)} – {formatKES(buyKesMax)}
          </span>

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

          <div className="trade-summary-box trade-summary-compact">
            <div className="tsb-row">
              <span>You pay</span>
              <strong>{formatKES(kesAmount)}</strong>
            </div>
            <div className="tsb-row tsb-row-receive">
              <span>You receive</span>
              <strong>{quotedCryptoAmount ? `${formatCryptoAmount(quotedCryptoAmount)} ${asset}` : `0 ${asset}`}</strong>
            </div>
            <p className="tsb-note">Tcash fee included · Manual review required</p>
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
            disabled={orderCreating || verifyStarting || !buyKesInput || kesAmount < buyKesMin || kesAmount > buyKesMax}
          >
            {verifyStarting ? "Starting World ID…" : orderCreating ? "Placing order…" : "Confirm buy order"}
          </button>
        </section>
      </div>
    );
  }

  /* ── STEP 3: Payment submitted — settlement receipt ────────────── */
  if (step === 3 && currentOrder) {
    return (
      <div className="content-grid">
        <Receipt
          title="Payment submitted"
          leadCopy={`Admin will verify your M-Pesa payment and release ${formatCryptoAmount(currentOrder.cryptoAmount)} ${currentOrder.asset} to your wallet.`}
          amountLabel="You paid"
          amountValue={formatKES(currentOrder.kesAmount)}
          reference={currentOrder.paymentReference || currentOrder.id.slice(0, 8).toUpperCase()}
          shareText={`Tcash receipt — bought ${formatCryptoAmount(currentOrder.cryptoAmount)} ${currentOrder.asset} for ${formatKES(currentOrder.kesAmount)}.`}
          onNewTrade={resetFlow}
          lines={[
            { label: "Order type", value: `Buy ${currentOrder.asset}` },
            { label: "You receive", value: `${formatCryptoAmount(currentOrder.cryptoAmount)} ${currentOrder.asset}` },
            ...(currentOrder.paymentReference
              ? [{ label: "M-Pesa code", value: currentOrder.paymentReference }]
              : []),
          ]}
        />
      </div>
    );
  }

  /* ── STEP 2: Payment instructions ────────────────────────────── */
  return (
    <div className="content-grid">
      <section className="panel stack task-panel trade-panel-compact">

        {/* Order placed banner */}
        {orderJustPlaced && currentOrder && (
          <div className="order-placed-banner">
            <span className="opb-check" aria-hidden="true"><Icon name="arrowRight" size={15} strokeWidth={2.4} /></span>
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
                    {copiedValue === label ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
            <p className="pic-note">Pay on M-Pesa, then paste the confirmation code below.</p>
          </div>

          <div className="trade-dest-strip">
            <span className="tds-icon" aria-hidden="true"><Icon name="arrowDown" size={16} strokeWidth={2.1} /></span>
            <div className="tds-text">
              <strong>
                {currentOrder.destinationUsername ? `@${currentOrder.destinationUsername}` : "Wallet connected"}
              </strong>
              <span>Crypto delivery destination</span>
            </div>
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

          <HoldToConfirm
            label="Hold to submit payment"
            holdingLabel="Keep holding…"
            disabled={!paymentReference.trim()}
            onConfirm={() => { tenderHaptics.send(); markAsPaid(paymentReference); }}
          />
        </div>
      </section>
    </div>
  );
}

export default BuyPage;
