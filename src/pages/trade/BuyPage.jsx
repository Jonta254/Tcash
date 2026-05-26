import { useState } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useOrderFlow } from "../../hooks/useOrderFlow";
import {
  APP_CONFIG,
  formatCryptoAmount,
  formatKES,
  getCurrentUser,
  getWorldAppContext,
  isUserAccessVerified,
  requestWorldVerification,
} from "../../services";

function BuyPage() {
  const settings = useAppSettings();
  const currentUser = getCurrentUser();
  const worldApp = getWorldAppContext();
  const [copiedValue, setCopiedValue] = useState("");
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

  const copyPaymentValue = async (label, value) => {
    const text = String(value || "").trim();

    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(label);
      window.setTimeout(() => setCopiedValue(""), 1800);
    } catch {
      setError(`Copy failed. Long-press ${label} and copy it manually.`);
    }
  };

  return (
    <div className="content-grid">
      <section className="panel stack task-panel">
        <div className="page-section-head">
          <div>
            <span className="brand-kicker">Buy WLD/USDC</span>
            <h2>Pay with M-Pesa and receive crypto</h2>
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
              </div>
            ) : null}

            <div className="amount-line">
              <span>You pay</span>
              <strong>{formatKES(kesAmount)}</strong>
            </div>
            <div className="amount-line">
              <span>You will receive</span>
              <strong>
                {quotedCryptoAmount ? `${formatCryptoAmount(quotedCryptoAmount)} ${asset}` : `0 ${asset}`}
              </strong>
            </div>
            <div className="soft-note">TMpesa fee included. Manual review required.</div>

            {(kesAmount < buyKesMin || kesAmount > buyKesMax) && buyKesInput ? (
              <div className="notice">
                Adjust the amount so the final buy total stays between {formatKES(buyKesMin)} and{" "}
                {formatKES(buyKesMax)}.
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
            <div className="payment-card payment-instructions-card">
              <span>Pay KES by M-Pesa PayBill</span>
              <strong>{formatKES(currentOrder.kesAmount)}</strong>
              <div className="copy-detail-list">
                <div>
                  <span>PayBill</span>
                  <code>{settings.mpesaPaybillNumber}</code>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => copyPaymentValue("PayBill", settings.mpesaPaybillNumber)}
                  >
                    {copiedValue === "PayBill" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div>
                  <span>Account</span>
                  <code>{settings.mpesaAccountNumber}</code>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => copyPaymentValue("Account", settings.mpesaAccountNumber)}
                  >
                    {copiedValue === "Account" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div>
                  <span>Name</span>
                  <code>{settings.mpesaTillName}</code>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => copyPaymentValue("Name", settings.mpesaTillName)}
                  >
                    {copiedValue === "Name" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <p>Use PayBill, then paste the M-Pesa transaction code below.</p>
            </div>

            <div className="info-box receipt-card">
              <strong>Crypto delivery destination</strong>
              <span>Used for crypto delivery after review.</span>
              {currentOrder.destinationUsername ? <code>@{currentOrder.destinationUsername}</code> : null}
              {currentOrder.walletAddress ? <code>Wallet connected</code> : null}
            </div>

            <div className="sr-only">
              <code>PayBill Number: {settings.mpesaPaybillNumber}</code>
              <code>Account Number: {settings.mpesaAccountNumber}</code>
              <code>Amount: KES {currentOrder.kesAmount.toLocaleString()}</code>
            </div>

            {step === 2 ? (
              <>
                <div className="field">
                  <label htmlFor="mpesaCode">M-Pesa transaction code</label>
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
                  The admin will verify your code and send {currentOrder.asset} to your recorded
                  destination.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default BuyPage;
