import { useAppSettings } from "../../hooks/useAppSettings";
import { useOrderFlow } from "../../hooks/useOrderFlow";
import {
  APP_CONFIG,
  formatCryptoAmount,
  formatKES,
  getCurrentUser,
  getWorldAppContext,
  isUserAccessVerified,
  openWhatsAppSupport,
  openSupportEmail,
  requestWorldVerification,
} from "../../services";

function BuyPage() {
  const settings = useAppSettings();
  const currentUser = getCurrentUser();
  const worldApp = getWorldAppContext();
  const {
    asset,
    setAsset,
    buyKesInput,
    setBuyKesInput,
    quotedCryptoAmount,
    walletAddress,
    setWalletAddress,
    paymentReference,
    setPaymentReference,
    step,
    currentOrder,
    error,
    setError,
    kesAmount,
    buyRateKes,
    buyKesMin,
    buyKesMax,
    placeOrder,
    markAsPaid,
    supportedAssets,
  } = useOrderFlow("buy");
  const needsOrderVerification =
    kesAmount >= APP_CONFIG.highValueOrderKesThreshold &&
    worldApp.isInstalled &&
    !isUserAccessVerified(currentUser);

  const handleCreateBuyOrder = async () => {
    if (needsOrderVerification) {
      try {
        setError("");
        const verification = await requestWorldVerification({
          action: APP_CONFIG.highValueOrderAction,
          signal: `buy:${asset}:${quotedCryptoAmount}:${kesAmount}`,
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
            <span className="brand-kicker">Buy WLD/USDC</span>
            <h2>Pay with M-Pesa and receive crypto</h2>
            <p className="muted">Enter the KES amount, review the quote, then return with your M-Pesa code.</p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Live rate</span>
              <strong>{formatKES(buyRateKes)}</strong>
            </div>
            <div>
              <span>Asset</span>
              <strong>{asset}</strong>
            </div>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        {step === 1 ? (
          <div className="stack">
            {currentUser?.walletAddress || currentUser?.username ? (
              <div className="info-box receipt-card">
                <strong>Destination ready</strong>
                <span>Used for crypto delivery after review.</span>
                {currentUser?.username ? <code>Username: @{currentUser.username}</code> : null}
                {currentUser?.walletAddress ? <code>Wallet connected</code> : null}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="buyAsset">Asset</label>
              <select id="buyAsset" value={asset} onChange={(event) => setAsset(event.target.value)}>
                {supportedAssets.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="buyAmountKes">Amount to pay (KES)</label>
              <input
                id="buyAmountKes"
                type="number"
                min="0"
                step="1"
                value={buyKesInput}
                onChange={(event) => setBuyKesInput(event.target.value)}
                placeholder="600"
              />
              <span className="muted field-hint">
                Buy limits: {formatKES(buyKesMin)} to {formatKES(buyKesMax)}.
              </span>
            </div>

            {!currentUser?.walletAddress && !currentUser?.username ? (
              <div className="field">
                <label htmlFor="walletAddress">Destination wallet address</label>
                <input
                  id="walletAddress"
                  value={walletAddress}
                  onChange={(event) => setWalletAddress(event.target.value)}
                  placeholder="0xYourWalletAddress"
                />
                <span className="muted field-hint">
                  Open with World App to detect this automatically.
                </span>
              </div>
            ) : null}

            <div className="amount-line">
              <span>Rate</span>
              <strong>{formatKES(buyRateKes)}</strong>
            </div>
            <div className="amount-line">
              <span>You will receive</span>
              <strong>{quotedCryptoAmount ? `${formatCryptoAmount(quotedCryptoAmount)} ${asset}` : `0 ${asset}`}</strong>
            </div>
            <div className="amount-line">
              <span>You will pay</span>
              <strong>{formatKES(kesAmount)}</strong>
            </div>
            <div className="soft-note">TMpesa fee included. Manual review required.</div>
            {(kesAmount < buyKesMin || kesAmount > buyKesMax) && buyKesInput ? (
              <div className="notice">
                Adjust the amount so the final buy total stays between {formatKES(buyKesMin)} and {formatKES(buyKesMax)}.
              </div>
            ) : null}
            {needsOrderVerification ? (
              <div className="notice">
                This order is above KES {APP_CONFIG.highValueOrderKesThreshold.toLocaleString()}.
                TMpesa will request a World human check before creating it.
              </div>
            ) : kesAmount >= APP_CONFIG.highValueOrderKesThreshold ? (
              <div className="notice">
                Your World account is already verified, so TMpesa will create this high-value order
                without requesting another human check.
              </div>
            ) : null}

            <button type="button" className="button" onClick={handleCreateBuyOrder}>
              Create Buy Order
            </button>
          </div>
        ) : null}

        {step >= 2 && currentOrder ? (
          <div className="stack">
            <div className="payment-card">
              <span>Pay to till</span>
              <strong>{settings.mpesaPaybillNumber}</strong>
              <p>{formatKES(currentOrder.kesAmount)}</p>
            </div>
            <div className="soft-note">TMpesa fee included.</div>

            <div className="info-box receipt-card">
              <strong>Crypto delivery destination</strong>
              <span>Admin will send after your M-Pesa code is confirmed.</span>
              {currentOrder.destinationUsername ? <code>@{currentOrder.destinationUsername}</code> : null}
              {currentOrder.walletAddress ? <code>Wallet connected</code> : null}
            </div>

            <div className="notice">
              Copy the till number, complete the M-Pesa payment, then come back and mark the order
              as paid using your transaction code.
            </div>

            <div className="sr-only">
              <code>Till Number: {settings.mpesaPaybillNumber}</code>
              <code>Amount: KES {currentOrder.kesAmount.toLocaleString()}</code>
            </div>

            {step === 2 ? (
              <>
                <div className="field">
                  <label htmlFor="mpesaCode">M-Pesa Transaction Code</label>
                  <input
                    id="mpesaCode"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="QWE123XYZ"
                  />
                </div>

                <button type="button" className="button" onClick={() => markAsPaid(paymentReference)}>
                  I HAVE PAID
                </button>
              </>
            ) : null}

            {step === 3 ? (
              <div className="success-panel">
              <strong>M-Pesa payment submitted</strong>
              <p>
                  The admin will verify your code and send {currentOrder.asset} to your recorded destination.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <aside className="summary-card stack guide-panel">
        <h3>Buy guide</h3>
        <div className="flow-list">
          <div><span>1</span><p>Choose the asset and enter the KES amount.</p></div>
          <div><span>2</span><p>Pay the shown amount to till {settings.mpesaPaybillNumber}.</p></div>
          <div><span>3</span><p>Submit your M-Pesa code for review.</p></div>
        </div>
        <div className="soft-note">TMpesa fee included. Manual review required.</div>
        <div className="support-card">
          <strong>Need help?</strong>
          <p className="muted">Use Gmail for support questions or WhatsApp for delayed crypto delivery.</p>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              openSupportEmail({
                subject: "TMpesa buy support",
                body: "Hello TMpesa team,\n\nI need help with my buy order.",
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
                message: "Hello TMpesa team,\n\nMy buy order is delayed. Please assist.",
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

export default BuyPage;
