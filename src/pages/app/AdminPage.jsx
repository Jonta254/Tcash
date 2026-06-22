import { useEffect, useMemo, useState } from "react";
import OrderCard from "../../components/orders/OrderCard";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  backfillExistingOrdersToAdminQueue,
  getAdminAlertsUpdatedEventName,
  getAdminAlerts,
  fetchSharedAdminOrders,
  getAllReferralClaims,
  getAllOrders,
  loginAdmin,
  markAdminAlertRead,
  getFeePerCoin,
  getCurrentUser,
  openOrderSupportEmail,
  syncOrderToAdminQueue,
  updateFeeKesPerCoin,
  updateOperationalSettings,
  updateOrder,
  updateReferralClaim,
} from "../../services";

function AdminPage() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [operatorForm, setOperatorForm] = useState({
    phone: "0795621901",
    password: "",
  });
  const [operatorError, setOperatorError] = useState("");
  const liveRates = useExchangeRates();
  const liveSettings = useAppSettings();
  const [orders, setOrders] = useState(() =>
    getAllOrders().slice().sort((a, b) => {
      const priority = { pending: 0, paid: 1, completed: 2, rejected: 3, cancelled: 3 };
      return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
    }),
  );
  const [adminAlerts, setAdminAlerts] = useState(getAdminAlerts());
  const [referralClaims, setReferralClaims] = useState(getAllReferralClaims());
  const [feeInputs, setFeeInputs] = useState(() => ({
    WLD: String(getFeePerCoin("WLD")),
    USDC: String(getFeePerCoin("USDC")),
  }));
  const [operationalInputs, setOperationalInputs] = useState(() => ({
    sellWalletAddress: liveSettings.sellWalletAddress,
    mpesaPaybillNumber: liveSettings.mpesaPaybillNumber,
    mpesaAccountNumber: liveSettings.mpesaAccountNumber,
    mpesaTillName: liveSettings.mpesaTillName,
    supportEmail: liveSettings.supportEmail,
    worldAppId: liveSettings.worldAppId || "",
  }));
  const [rateMessage, setRateMessage] = useState("");
  const [rateError, setRateError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [orderQueueMessage, setOrderQueueMessage] = useState("");
  const [orderQueueError, setOrderQueueError] = useState("");
  const payoutQueue = useMemo(
    () => orders.filter((order) => order.type === "sell" && order.status === "paid"),
    [orders],
  );
  const referralQueue = useMemo(
    () => referralClaims.filter((claim) => ["pending", "approved"].includes(claim.status)),
    [referralClaims],
  );
  const unreadAlerts = useMemo(
    () => adminAlerts.filter((alert) => !alert.read),
    [adminAlerts],
  );

  useEffect(() => {
    let active = true;

    const syncAdminData = async () => {
      setUser(getCurrentUser());
      setOrders(getAllOrders().slice().sort((a, b) => {
        const priority = { pending: 0, paid: 1, completed: 2, rejected: 3, cancelled: 3 };
        return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
      }));
      setReferralClaims(getAllReferralClaims());
      setAdminAlerts(getAdminAlerts());

      try {
        await backfillExistingOrdersToAdminQueue();
        const payload = await fetchSharedAdminOrders();

        if (!active) {
          return;
        }

        if (payload.pendingSetup) {
          setOrderQueueMessage(payload.message || "Shared admin order queue needs setup.");
          setOrderQueueError("");
          return;
        }

        const rawOrders = payload.orders || getAllOrders();
        setOrders(rawOrders.slice().sort((a, b) => {
          const priority = { pending: 0, paid: 1, completed: 2, rejected: 3, cancelled: 3 };
          return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
        }));
        setOrderQueueMessage(payload.orders?.length ? "Shared admin queue loaded." : "");
        setOrderQueueError("");
      } catch (error) {
        if (active) {
          setOrderQueueError(
            error instanceof Error ? error.message : "Could not load shared admin orders.",
          );
        }
      }
    };
    const adminAlertsEventName = getAdminAlertsUpdatedEventName();

    const syncAdminDataSafely = () => {
      void syncAdminData();
    };

    syncAdminDataSafely();

    window.addEventListener("focus", syncAdminDataSafely);
    window.addEventListener("storage", syncAdminDataSafely);
    window.addEventListener(adminAlertsEventName, syncAdminDataSafely);
    const refreshTimer = window.setInterval(syncAdminDataSafely, 10000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", syncAdminDataSafely);
      window.removeEventListener("storage", syncAdminDataSafely);
      window.removeEventListener(adminAlertsEventName, syncAdminDataSafely);
    };
  }, []);

  if (!user?.isAdmin) {
    return (
      <div className="stack page-enter">
        <section className="panel stack task-panel auth-layout-single">
          <div className="page-section-head">
            <div>
              <span className="brand-kicker">Operator access</span>
              <h2>Open the TMpesa admin desk</h2>
              <p className="muted">
                Sign in here to review orders, manage payouts, and update live trading settings.
              </p>
            </div>
          </div>

          <div className="auth-gate-card">
            <div className="auth-gate-head">
              <div className="auth-gate-copy">
                <div>
                  <span className="brand-kicker">Private operator route</span>
                  <h3>Admin access stays outside the normal user wallet flow.</h3>
                </div>
              </div>
              <span className="secure-access-trust">Protected desk</span>
            </div>

            <div className="auth-mini-flow">
              <div className="active">
                <span>1</span>
                <strong>Sign in</strong>
              </div>
              <div>
                <span>2</span>
                <strong>Review queue</strong>
              </div>
              <div>
                <span>3</span>
                <strong>Confirm payouts</strong>
              </div>
            </div>

            {operatorError ? <div className="error">{operatorError}</div> : null}

            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                setOperatorError("");

                try {
                  const nextUser = loginAdmin(operatorForm);
                  setUser(nextUser);
                  setOperatorForm((current) => ({ ...current, password: "" }));
                } catch (error) {
                  setOperatorError(error.message);
                }
              }}
            >
              <div className="field">
                <label htmlFor="adminPhoneNumber">Admin phone number</label>
                <input
                  id="adminPhoneNumber"
                  value={operatorForm.phone}
                  onChange={(event) =>
                    setOperatorForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="0795621901"
                  autoComplete="username"
                />
              </div>

              <div className="field">
                <label htmlFor="adminPassword">Admin password</label>
                <input
                  id="adminPassword"
                  type="password"
                  value={operatorForm.password}
                  onChange={(event) =>
                    setOperatorForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Enter operator password"
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="button">
                Open Admin
              </button>
            </form>
          </div>
        </section>
      </div>
    );
  }

  const handleStatusUpdate = async (order, status) => {
    const confirmMessages = {
      completed: "Mark this order as completed? This will notify the user.",
      rejected: "Mark this order as failed? This cannot be undone.",
      paid: "Mark this order as paid?",
    };
    const confirmMsg = confirmMessages[status] || `Update order status to ${status}?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }
    setOrderQueueError("");
    const updated = updateOrder(order.id, { status }, order, { sync: false });

    try {
      // Admin is doing this update — no need to re-notify admin; user gets
      // notified via notifyWorldUserOrderStatus inside updateOrder above.
      await syncOrderToAdminQueue(updated, { notifyAdmin: false });
    } catch (error) {
      setOrderQueueError(
        error instanceof Error
          ? error.message
          : "TMpesa could not save this status to the shared admin queue.",
      );
    }

    setOrders(getAllOrders().slice().sort((a, b) => {
      const priority = { pending: 0, paid: 1, completed: 2, rejected: 3, cancelled: 3 };
      return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
    }));
  };

  const handleFeeSave = () => {
    setRateError("");
    setRateMessage("");

    try {
      const nextFees = updateFeeKesPerCoin(feeInputs);
      setFeeInputs({
        WLD: String(nextFees.WLD),
        USDC: String(nextFees.USDC),
      });
      setRateMessage("TMpesa fee settings updated successfully.");
    } catch (error) {
      setRateError(error.message);
    }
  };

  const handleReferralClaimUpdate = (claimId, status) => {
    updateReferralClaim(claimId, {
      status,
      paidAt: status === "paid" ? new Date().toISOString() : undefined,
    });
    setReferralClaims(getAllReferralClaims());
  };

  const handleSettingsSave = () => {
    setSettingsError("");
    setSettingsMessage("");

    try {
      const nextSettings = updateOperationalSettings(operationalInputs);
      setOperationalInputs({
        sellWalletAddress: nextSettings.sellWalletAddress,
        mpesaPaybillNumber: nextSettings.mpesaPaybillNumber,
        mpesaAccountNumber: nextSettings.mpesaAccountNumber,
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
    <div className="stack page-enter">
      <section className="panel stack task-panel">
        <div className="page-section-head">
          <div>
            <span className="brand-kicker">Admin panel</span>
            <h2>Manual confirmation and live settings</h2>
            <p className="muted">
              Review orders, confirm referral payouts, and manage TMpesa's live operational setup.
            </p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Total orders</span>
              <strong>{orders.length}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong style={{ color: orders.filter(o => o.status === "pending" || o.status === "paid").length ? "var(--warning)" : "inherit" }}>
                {orders.filter(o => o.status === "pending" || o.status === "paid").length}
              </strong>
            </div>
            <div>
              <span>Unread alerts</span>
              <strong>{unreadAlerts.length}</strong>
            </div>
          </div>
        </div>
        {orderQueueError ? <div className="error">{orderQueueError}</div> : null}
        {orderQueueMessage ? <div className="notice">{orderQueueMessage}</div> : null}
      </section>

      {adminAlerts.length ? (
        <section className="panel stack task-panel">
          <div className="split">
            <div>
              <span className="brand-kicker">Admin alerts</span>
              <h3>Order and referral notifications</h3>
              <p className="muted">
                TMpesa records admin alerts here and also attempts Gmail and World push delivery when configured.
              </p>
            </div>
            <span className={`status-pill ${unreadAlerts.length ? "pending" : "completed"}`}>
              {unreadAlerts.length ? `${unreadAlerts.length} unread` : "All seen"}
            </span>
          </div>
          <div className="stack">
            {adminAlerts.slice(0, 6).map((alert) => (
              <div key={alert.id} className="info-box stack">
                <div className="split">
                  <strong>{alert.title}</strong>
                  <small>{new Date(alert.createdAt).toLocaleString()}</small>
                </div>
                <span className="muted">{alert.message}</span>
                {!alert.read ? (
                  <div className="button-row compact-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setAdminAlerts(markAdminAlertRead(alert.id))}
                    >
                      Mark seen
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel stack task-panel">
        <div className="split">
          <div>
            <h3>Live Price and Fee Control</h3>
            <p className="muted">
              TMpesa now reads live WLD and USDC market prices from World's public price endpoint.
              Set the KES fee deducted from each sell coin and added to each buy coin.
            </p>
          </div>
          <div className="stack">
            <div className="tag">WLD live: KES {liveRates.WLD}</div>
            <div className="tag">USDC live: KES {liveRates.USDC}</div>
          </div>
        </div>

        {rateError ? <div className="error">{rateError}</div> : null}
        {rateMessage ? <div className="notice">{rateMessage}</div> : null}

        <div className="info-grid">
          <div className="field">
            <label htmlFor="feeWld">WLD fee per coin (KES)</label>
            <input
              id="feeWld"
              type="number"
              min="0"
              step="0.01"
              value={feeInputs.WLD || ""}
              onChange={(event) =>
                setFeeInputs((current) => ({ ...current, WLD: event.target.value }))
              }
              placeholder="10"
            />
          </div>

          <div className="field">
            <label htmlFor="feeUsdc">USDC fee per coin (KES)</label>
            <input
              id="feeUsdc"
              type="number"
              min="0"
              step="0.01"
              value={feeInputs.USDC || ""}
              onChange={(event) =>
                setFeeInputs((current) => ({ ...current, USDC: event.target.value }))
              }
              placeholder="10"
            />
          </div>
        </div>

        <button type="button" className="button" onClick={handleFeeSave}>
          Save Fee Settings
        </button>
      </section>

      <section className="panel stack task-panel">
        <div>
          <h3>Mini App Operations</h3>
          <p className="muted">
            Set the live wallet receiver for sell-side payments, the M-Pesa PayBill for buy orders,
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
              <label htmlFor="mpesaPaybillNumber">M-Pesa PayBill</label>
              <input
                id="mpesaPaybillNumber"
                value={operationalInputs.mpesaPaybillNumber}
                onChange={(event) =>
                  setOperationalInputs((current) => ({
                    ...current,
                    mpesaPaybillNumber: event.target.value,
                  }))
                }
                placeholder="542542"
              />
            </div>

            <div className="field">
              <label htmlFor="mpesaAccountNumber">Account Number</label>
              <input
                id="mpesaAccountNumber"
                value={operationalInputs.mpesaAccountNumber}
                onChange={(event) =>
                  setOperationalInputs((current) => ({
                    ...current,
                    mpesaAccountNumber: event.target.value,
                  }))
                }
                placeholder="856340"
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
                placeholder="B.O.J"
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
              Used to build the Open in World App button with the documented mini app deeplink format.
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

      {referralQueue.length ? (
        <section className="panel stack task-panel">
          <div>
            <span className="brand-kicker">Referral claims</span>
            <h3>Referral rewards ready for M-Pesa payout</h3>
            <p className="muted">
              These users reached a referral target and requested payout. Review and send the reward
              directly to the saved M-Pesa number.
            </p>
          </div>
          <div className="stack">
            {referralQueue.map((claim) => (
              <div key={claim.id} className="info-box stack">
                <strong>{claim.referrerUsername ? `@${claim.referrerUsername}` : claim.referrerLabel}</strong>
                <code>M-Pesa: {claim.referrerMpesaPhoneNumber}</code>
                <code>Milestone: {claim.milestoneUsers} referrals</code>
                <code>Reward: KES {claim.rewardKes}</code>
                <code>Status: {claim.status}</code>
                <div className="button-row compact-actions">
                  {claim.status !== "approved" ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => handleReferralClaimUpdate(claim.id, "approved")}
                    >
                      Mark Approved
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button"
                    onClick={() => handleReferralClaimUpdate(claim.id, "paid")}
                  >
                    Mark Paid
                  </button>
                </div>
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
                {order.status !== "paid" && order.status !== "completed" && order.status !== "rejected" ? (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => handleStatusUpdate(order, "paid")}
                  >
                    Mark Paid
                  </button>
                ) : null}
                {order.status !== "completed" && order.status !== "rejected" ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() => handleStatusUpdate(order, "completed")}
                  >
                    Mark Completed
                  </button>
                ) : null}
                {order.status !== "completed" && order.status !== "rejected" ? (
                  <button
                    type="button"
                    className="button-ghost"
                    style={{ color: "var(--error, #f87171)" }}
                    onClick={() => handleStatusUpdate(order, "rejected")}
                  >
                    Mark Failed
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => openOrderSupportEmail(order, "support")}
                >
                  Email User
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
