import { useState } from "react";
import { Navigate } from "react-router-dom";
import OrderCard from "../../components/orders/OrderCard";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  getAllOrders,
  getCurrentUser,
  getExchangeRates,
  openOrderSupportEmail,
  updateExchangeRates,
  updateOperationalSettings,
  updateOrder,
} from "../../services";

function AdminPage() {
  const user = getCurrentUser();
  const liveRates = useExchangeRates();
  const liveSettings = useAppSettings();

  // TODO: Replace this temporary admin gate with real authentication before production.
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  const [orders, setOrders] = useState(getAllOrders());
  const [rateInputs, setRateInputs] = useState(() =>
    Object.entries(getExchangeRates()).reduce((accumulator, [asset, rate]) => {
      accumulator[asset] = String(rate);
      return accumulator;
    }, {}),
  );
  const [operationalInputs, setOperationalInputs] = useState(() => ({
    sellWalletAddress: liveSettings.sellWalletAddress,
    mpesaPaybillNumber: liveSettings.mpesaPaybillNumber,
    mpesaTillName: liveSettings.mpesaTillName,
    supportEmail: liveSettings.supportEmail,
    worldAppId: liveSettings.worldAppId || "",
  }));
  const [rateMessage, setRateMessage] = useState("");
  const [rateError, setRateError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const payoutQueue = orders.filter((order) => order.type === "sell" && order.status === "paid");

  const handleStatusUpdate = (orderId, status) => {
    updateOrder(orderId, { status });
    setOrders(getAllOrders());
  };

  const handleRateSave = () => {
    setRateError("");
    setRateMessage("");

    try {
      const nextRates = updateExchangeRates(rateInputs);
      setRateInputs(
        Object.entries(nextRates).reduce((accumulator, [asset, rate]) => {
          accumulator[asset] = String(rate);
          return accumulator;
        }, {}),
      );
      setRateMessage("Exchange rates updated successfully.");
    } catch (error) {
      setRateError(error.message);
    }
  };

  const handleSettingsSave = () => {
    setSettingsError("");
    setSettingsMessage("");

    try {
      const nextSettings = updateOperationalSettings(operationalInputs);
      setOperationalInputs({
        sellWalletAddress: nextSettings.sellWalletAddress,
        mpesaPaybillNumber: nextSettings.mpesaPaybillNumber,
        mpesaTillName: nextSettings.mpesaTillName,
        supportEmail: nextSettings.supportEmail,
        worldAppId: nextSettings.worldAppId || "",
      });
      setSettingsMessage("Operational settings updated successfully.");
    } catch (error) {
      setSettingsError(error.message);
    }
  };

  return (
    <div className="stack">
      <section className="panel stack task-panel">
        <div className="page-section-head">
          <div>
            <span className="brand-kicker">Admin panel</span>
            <h2>Manual confirmation and live settings</h2>
            <p className="muted">
              Update exchange rates, operational details, and review order status after manual
              settlement has been completed.
            </p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Total orders</span>
              <strong>{orders.length}</strong>
            </div>
            <div>
              <span>Payout queue</span>
              <strong>{payoutQueue.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel stack task-panel">
        <div className="split">
          <div>
            <h3>Exchange Rate Control</h3>
            <p className="muted">
              Update the current KES rates for WLD and USDC here. Buy and sell calculations will
              use the selected asset rate immediately.
            </p>
          </div>
          <div className="stack">
            <div className="tag">WLD: KES {liveRates.WLD}</div>
            <div className="tag">USDC: KES {liveRates.USDC}</div>
          </div>
        </div>

        {rateError ? <div className="error">{rateError}</div> : null}
        {rateMessage ? <div className="notice">{rateMessage}</div> : null}

        <div className="info-grid">
          <div className="field">
            <label htmlFor="rateWld">KES per WLD</label>
            <input
              id="rateWld"
              type="number"
              min="1"
              step="0.01"
              value={rateInputs.WLD || ""}
              onChange={(event) =>
                setRateInputs((current) => ({ ...current, WLD: event.target.value }))
              }
              placeholder="120"
            />
          </div>

          <div className="field">
            <label htmlFor="rateUsdc">KES per USDC</label>
            <input
              id="rateUsdc"
              type="number"
              min="1"
              step="0.01"
              value={rateInputs.USDC || ""}
              onChange={(event) =>
                setRateInputs((current) => ({ ...current, USDC: event.target.value }))
              }
              placeholder="128"
            />
          </div>
        </div>

        <button type="button" className="button" onClick={handleRateSave}>
          Save Rates
        </button>
      </section>

      <section className="panel stack task-panel">
        <div>
          <h3>Mini App Operations</h3>
          <p className="muted">
            Set the live wallet receiver for sell-side payments, the M-Pesa till for buy orders,
            and the Gmail support destination for user help actions.
          </p>
        </div>

        {settingsError ? <div className="error">{settingsError}</div> : null}
        {settingsMessage ? <div className="notice">{settingsMessage}</div> : null}

        <div className="stack">
          <div className="field">
            <label htmlFor="sellWalletAddress">Sell Wallet Address</label>
            <input
              id="sellWalletAddress"
              value={operationalInputs.sellWalletAddress}
              onChange={(event) =>
                setOperationalInputs((current) => ({
                  ...current,
                  sellWalletAddress: event.target.value,
                }))
              }
              placeholder="0xRecipientWallet"
            />
            <span className="muted field-hint">
              WLD sell orders use this wallet for the in-app send flow inside TMpesa.
            </span>
          </div>

          <div className="info-grid">
            <div className="field">
              <label htmlFor="mpesaPaybillNumber">M-Pesa Till</label>
              <input
                id="mpesaPaybillNumber"
                value={operationalInputs.mpesaPaybillNumber}
                onChange={(event) =>
                  setOperationalInputs((current) => ({
                    ...current,
                    mpesaPaybillNumber: event.target.value,
                  }))
                }
                placeholder="522522"
              />
            </div>

            <div className="field admin-hidden-field">
              <label htmlFor="mpesaTillName">Business Name</label>
              <input
                id="mpesaTillName"
                value={operationalInputs.mpesaTillName}
                onChange={(event) =>
                  setOperationalInputs((current) => ({
                    ...current,
                    mpesaTillName: event.target.value,
                  }))
                }
                placeholder="TMpesa Exchange"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="supportEmail">Support Gmail</label>
            <input
              id="supportEmail"
              type="email"
              value={operationalInputs.supportEmail}
              onChange={(event) =>
                setOperationalInputs((current) => ({
                  ...current,
                  supportEmail: event.target.value,
                }))
              }
              placeholder="brianokindo2022@gmail.com"
            />
          </div>

          <div className="field">
            <label htmlFor="worldAppId">World App ID</label>
            <input
              id="worldAppId"
              value={operationalInputs.worldAppId || ""}
              onChange={(event) =>
                setOperationalInputs((current) => ({
                  ...current,
                  worldAppId: event.target.value,
                }))
              }
              placeholder="app_xxxxxxxxxxxxx"
            />
            <span className="muted field-hint">
              Used to build the Open in World App button with the official mini app deeplink format.
            </span>
          </div>
        </div>

        <button type="button" className="button" onClick={handleSettingsSave}>
          Save Mini App Settings
        </button>
      </section>

      {payoutQueue.length ? (
        <section className="panel stack task-panel">
          <div>
            <span className="brand-kicker">Payout Queue</span>
            <h3>Sell orders ready for M-Pesa payout</h3>
            <p className="muted">
              These users have already sent crypto. Use the name and M-Pesa number below when
              sending their KES payout.
            </p>
          </div>
          <div className="stack">
            {payoutQueue.map((order) => (
              <div key={`queue-${order.id}`} className="info-box">
                <strong>{order.userLabel}</strong>
                <code>M-Pesa: {order.payoutPhoneNumber || order.userMpesaPhoneNumber || "Not provided"}</code>
                <code>Asset: {order.cryptoAmount} {order.asset}</code>
                <code>KES to pay: {order.kesAmount.toLocaleString()}</code>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {orders.length ? (
        <section className="order-grid">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order}>
              <div className="action-grid">
                {order.status !== "paid" ? (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => handleStatusUpdate(order.id, "paid")}
                  >
                    Mark Paid
                  </button>
                ) : null}
                {order.status !== "completed" ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() => handleStatusUpdate(order.id, "completed")}
                  >
                    Mark Completed
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => openOrderSupportEmail(order, "support")}
                >
                  Email User Support
                </button>
              </div>
            </OrderCard>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <h3>No orders to review</h3>
        </section>
      )}
    </div>
  );
}

export default AdminPage;
