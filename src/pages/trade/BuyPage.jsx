import { useState } from "react";
import Icon from "../../components/icons/Icon";
import AmountField from "../../components/interaction/AmountField";
import HoldToConfirm from "../../components/interaction/HoldToConfirm";
import QuoteDetails from "../../components/orders/QuoteDetails";
import Receipt from "../../components/receipt/Receipt";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useOrderFlow } from "../../hooks/useOrderFlow";
import { useHighValueVerification } from "../../hooks/useHighValueVerification";
import { formatCryptoAmount, formatKES, getCurrentUser, haptic, tenderHaptics } from "../../services";

function BuyPage() {
  const settings     = useAppSettings();
  const currentUser  = getCurrentUser();
  const [copiedValue,    setCopiedValue]    = useState("");
  const [orderCreating,  setOrderCreating]  = useState(false);

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
    feeKesAmount, exchangeRate,
    grossKesAmount,
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
      }
      setOrderCreating(false);
    });
  };

  const resetFlow = () => {
    setStep(1);
    setCurrentOrder(null);

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
          {error && <div className="error" role="alert">{error}</div>}
          {verifyError && <div className="error">{verifyError}</div>}
          {worldIdWidget}

          {(currentUser?.walletAddress || currentUser?.username) && (
          <div className="trade-dest-strip">
              <span className="tds-icon" aria-hidden="true"><Icon name="arrowDown" size={16} strokeWidth={2.1} /></span>
              <div className="tds-text">
                <strong>{currentUser?.username ? `@${currentUser.username}` : "Wallet connected"}</strong>
                <span>Crypto delivered here after operator review</span>
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

          <QuoteDetails type="buy" asset={asset}
            amount={quotedCryptoAmount}
            gross={grossKesAmount} fee={feeKesAmount} total={kesAmount} rate={exchangeRate} />

          {(kesAmount < buyKesMin || kesAmount > buyKesMax) && buyKesInput && (
            <div className="notice">
              Adjust so the total stays between {formatKES(buyKesMin)} and {formatKES(buyKesMax)}.
            </div>
          )}

          <button
            type="button"
            className="button"
            onClick={handleCreateBuyOrder}
            disabled={orderCreating || verifyStarting || exchangeRate <= 0 || !buyKesInput || kesAmount < buyKesMin || kesAmount > buyKesMax}
          >
            {verifyStarting ? "Starting World ID…" : orderCreating ? "Placing order…" : "Review buy order"}
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
          leadCopy={`An operator will verify your M-Pesa payment and release ${formatCryptoAmount(currentOrder.cryptoAmount)} ${currentOrder.asset} to your wallet.`}
          amountLabel="Amount submitted"
          amountValue={formatKES(currentOrder.kesAmount)}
          reference={currentOrder.paymentReference || currentOrder.id.slice(0, 8).toUpperCase()}
          shareText={`Tcash order — submitted a buy of ${formatCryptoAmount(currentOrder.cryptoAmount)} ${currentOrder.asset} for ${formatKES(currentOrder.kesAmount)}.`}
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
                { label: "PayBill", value: currentOrder.mpesaPaybillNumber || settings.mpesaPaybillNumber },
                { label: "Account", value: currentOrder.mpesaAccountNumber || settings.mpesaAccountNumber },
                { label: "Name",    value: currentOrder.mpesaTillName || settings.mpesaTillName },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span>{label}</span>
                  <code>{value}</code>
                  <button
                    type="button"
                    className="copy-button"
                    aria-label={`Copy ${label}`}
                    onClick={() => copyValue(label, value)}
                  >
                    {copiedValue === label ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
            <p className="pic-note">Tcash fee included: {formatKES(currentOrder.feeKesAmount)}.</p>
            <p className="pic-note">Pay on M-Pesa, then paste the confirmation code below.</p>
          </div>


            <details className="tcash-quote-disclosure"><summary>Saved quote and fee breakdown</summary><QuoteDetails type="buy" asset={currentOrder.asset} amount={currentOrder.cryptoAmount}
          gross={currentOrder.grossKesAmount} fee={currentOrder.feeKesAmount} total={currentOrder.kesAmount}
          rate={currentOrder.grossKesAmount / currentOrder.cryptoAmount} /></details>
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
              onChange={(e) => setPaymentReference(e.target.value.toUpperCase())}
              placeholder="ABC123DE45"
              maxLength={10} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            />
          </div>

          <HoldToConfirm
            label="Hold to submit payment"
            holdingLabel="Keep holding…"
            disabled={!paymentReference.trim()}
            onConfirm={async () => { tenderHaptics.send(); await markAsPaid(paymentReference); }}
          />
        </div>
      </section>
    </div>
  );
}

export default BuyPage;
