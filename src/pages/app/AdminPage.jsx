import { useEffect, useMemo, useRef, useState } from "react";
import OrderCard from "../../components/orders/OrderCard";
import { useAdminSession } from "../../hooks/useAdminSession";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  backfillExistingOrdersToAdminQueue,
  formatKES,
  getAdminAlertsUpdatedEventName,
  getAdminAlerts,
  fetchSharedAdminOrders,
  fetchSharedReferralClaimQueue,
  getAllReferralClaims,
  getAllOrders,
  markAdminAlertRead,
  getFeePerCoin,
  haptic,
  openOrderSupportEmail,
  syncOrderToAdminQueue,
  tenderHaptics,
  updateFeeKesPerCoin,
  updateOperationalSettings,
  updateOrder,
  updateReferralClaim,
} from "../../services";

function AdminPage() {
  const adminSession = useAdminSession();
  const liveRates = useExchangeRates();
  const liveSettings = useAppSettings();
  const [orders, setOrders] = useState(() =>
    getAllOrders().slice().sort((a, b) => {
      const priority = { pending: 0, paid: 1, completed: 2, rejected: 3, cancelled: 3 };
      return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
    }),
  );
  // The console used to render every section — alerts, rates, mini-app
  // settings, payout queue, claims and the full order list — in one column,
  // which on a phone is five-plus screens of scrolling to reach the orders
  // an operator actually opens this page for. One section at a time, orders
  // first, using the same pill tabs as the Orders page.
  const [adminTab, setAdminTab] = useState("orders");
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
  }));
  const [rateMessage, setRateMessage] = useState("");
  const [rateError, setRateError] = useState("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [referralUpdatingId, setReferralUpdatingId] = useState(null);
  const [referralClaimError, setReferralClaimError] = useState("");
  const [orderQueueMessage, setOrderQueueMessage] = useState("");
  const [orderQueueError, setOrderQueueError] = useState("");
  const [orderUpdatingId, setOrderUpdatingId] = useState(null);
  const [queueReady, setQueueReady] = useState(false);
  const feesEdited = useRef(false);
  const operationsEdited = useRef(false);
  useEffect(() => {
    if (!feesEdited.current) setFeeInputs({ WLD: String(liveSettings.feeKesPerCoin?.WLD ?? 0), USDC: String(liveSettings.feeKesPerCoin?.USDC ?? 0) });
    if (!operationsEdited.current) setOperationalInputs({ sellWalletAddress: liveSettings.sellWalletAddress, mpesaPaybillNumber: liveSettings.mpesaPaybillNumber, mpesaAccountNumber: liveSettings.mpesaAccountNumber, mpesaTillName: liveSettings.mpesaTillName, supportEmail: liveSettings.supportEmail });
  }, [liveSettings]);
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
  // Surfaced as tab badges so a collapsed section can still say it needs
  // attention — the whole point of hiding sections is that nothing hidden
  // goes unnoticed.
  const pendingOrderCount = useMemo(
    () => orders.filter((order) => order.status === "pending" || order.status === "paid").length,
    [orders],
  );
  const pendingClaimCount = referralQueue.length;

  useEffect(() => {
    // Nothing here runs until the server has confirmed this session is
    // really an admin — fetching the order queue speculatively before
    // that would be pointless (the server rejects it anyway) and is the
    // wrong instinct for a privileged screen: assume denied until proven
    // otherwise, not the reverse.
    if (adminSession !== "granted") {
      return undefined;
    }

    let active = true;
    let refreshing = false;

    const syncAdminData = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
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

          if (!payload?.ok || payload.pendingSetup) {
            setQueueReady(false);
            setOrderQueueError(payload?.error || payload?.message || "Could not refresh orders. Status changes are paused until the queue reconnects.");
            return;
          }

          setQueueReady(true);

          const rawOrders = payload.orders || getAllOrders();
          setOrders(rawOrders.slice().sort((a, b) => {
            const priority = { pending: 0, paid: 1, completed: 2, rejected: 3, cancelled: 3 };
            return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
          }));
          setOrderQueueMessage(payload.orders?.length ? "Shared admin queue loaded." : "");
          setOrderQueueError("");
        } catch (error) {
          if (active) {
            setQueueReady(false);
            setOrderQueueError(
              error instanceof Error ? error.message : "Could not load shared admin orders.",
            );
          }
        }

        try {
          const claimsPayload = await fetchSharedReferralClaimQueue();

          if (active && claimsPayload?.ok) {
            setReferralClaims(claimsPayload.claims || []);
            setReferralClaimError("");
          } else if (active) {
            setReferralClaimError("Past claims could not refresh. Displayed records may be outdated.");
          }
        } catch {
          if (active) setReferralClaimError("Past claims could not refresh. Displayed records may be outdated.");
          // Falls back to whatever's in local storage from this
          // browser's own prior loads — same tolerance as the order
          // queue's own fetch above.
        }
      } finally { refreshing = false; }
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
  }, [adminSession]);

  // While the server check is in flight, render nothing rather than a
  // flash of "Access denied" (or worse, a flash of the console) — a
  // privileged screen should never show either state speculatively.
  if (adminSession === "checking") {
    return <div className="stack page-enter" aria-busy="true" />;
  }

  if (adminSession !== "granted") {
    return (
      <div className="stack page-enter">
        <section className="panel stack task-panel auth-layout-single">
          <div className="page-section-head">
            <div>
              <span className="brand-kicker">Operator access</span>
              <h2>This account isn't recognized as a Tcash operator</h2>
              <p className="muted">
                The admin desk opens automatically for the operator's World App wallet — there's no
                separate sign-in. If this should be an operator account, it needs to be added to the
                server's approved admin wallet list.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const handleStatusUpdate = async (order, status) => {
    if (orderUpdatingId || !queueReady) return;
    const confirmMessages = {
      completed: "Confirm that you checked the payment asset, amount, receiver and reference, and already sent the exact payout. Mark this order settled?",
      rejected: "Mark this order as failed? This cannot be undone.",
      paid: "Confirm that payment evidence has been submitted. This does not confirm receipt or settlement. Move this order to review?",
    };
    const confirmMsg = confirmMessages[status] || `Update order status to ${status}?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    const resort = (list) =>
      list.slice().sort((a, b) => {
        const priority = { pending: 0, paid: 1, completed: 2, rejected: 3, cancelled: 3 };
        return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
      });

    setOrderQueueError("");
    setOrderUpdatingId(order.id);
    const updated = { ...order, status, updatedAt: new Date().toISOString() };
    try {
      await syncOrderToAdminQueue(updated, { notifyAdmin: false });
      updateOrder(order.id, { status }, order, { sync: false });
    } catch (error) {
      tenderHaptics.fail();
      setOrderQueueError((error instanceof Error ? error.message : "Tcash could not save this status.") + " Refresh the queue before retrying.");
      return;
    } finally {
      setOrderUpdatingId(null);
    }

    if (status === "completed") {
      tenderHaptics.settle();
    } else if (status === "rejected") {
      tenderHaptics.cancellation();
    } else {
      tenderHaptics.commit();
    }

    setOrders(resort(getAllOrders()));
  };

  const handleFeeSave = async () => {
    if (feeSaving) return;
    setRateError("");
    setRateMessage("");
    setFeeSaving(true);

    try {
      const nextFees = await updateFeeKesPerCoin(feeInputs);
      feesEdited.current = false;
      setFeeInputs({
        WLD: String(nextFees.WLD),
        USDC: String(nextFees.USDC),
      });
      setRateMessage("Saved — every user now sees this fee.");
    } catch (error) {
      setRateError(error.message);
    } finally {
      setFeeSaving(false);
    }
  };

  const handleReferralClaimUpdate = async (claimId, status) => {
    if (referralUpdatingId) return;
    setReferralUpdatingId(claimId);
    setReferralClaimError("");
    const claim = referralClaims.find((entry) => entry.id === claimId);

    try {
      const updated = await updateReferralClaim(claimId, {
        status,
        paidAt: status === "paid" ? new Date().toISOString() : undefined,
      });
      setReferralClaims((current) => current.map((entry) => (entry.id === claimId ? updated : entry)));
      tenderHaptics.commit();
    } catch (error) {
      // Nothing changed locally yet (the write is server-first — see
      // referralService.js), so there's no optimistic state to roll
      // back, just an error to surface plainly.
      setReferralClaimError(
        (error instanceof Error ? error.message : "Tcash could not update this claim.") +
          (claim ? ` (${claim.referrerUsername ? `@${claim.referrerUsername}` : claim.referrerLabel})` : ""),
      );
    } finally {
      setReferralUpdatingId(null);
    }
  };

  const handleSettingsSave = async () => {
    if (settingsSaving) return;
    setSettingsError("");
    setSettingsMessage("");
    setSettingsSaving(true);

    try {
      const nextSettings = await updateOperationalSettings(operationalInputs);
      operationsEdited.current = false;
      setOperationalInputs({
        sellWalletAddress: nextSettings.sellWalletAddress,
        mpesaPaybillNumber: nextSettings.mpesaPaybillNumber,
        mpesaAccountNumber: nextSettings.mpesaAccountNumber,
        mpesaTillName: nextSettings.mpesaTillName,
        supportEmail: nextSettings.supportEmail,
      });
      setSettingsMessage("Saved — every user now reads these live settings.");
    } catch (error) {
      setSettingsError(error.message);
    } finally {
      setSettingsSaving(false);
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
              Review payment evidence, settle orders, and manage Tcash's live settings.
            </p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Total orders</span>
              <strong>{orders.length}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong style={{ color: pendingOrderCount ? "var(--warning)" : "inherit" }}>
                {pendingOrderCount}
              </strong>
            </div>
            <div>
              <span>Unread alerts</span>
              <strong>{unreadAlerts.length}</strong>
            </div>
          </div>
        </div>
        {orderQueueError ? <div className="error" role="alert">{orderQueueError}</div> : null}
        {orderQueueMessage ? <div className="notice" role="status">{orderQueueMessage}</div> : null}

        <div className="orders-tab-row" role="tablist" aria-label="Admin sections">
          {[
            { id: "orders", label: "Orders", count: pendingOrderCount },
            { id: "alerts", label: "Alerts", count: unreadAlerts.length },
            { id: "claims", label: "Past claims", count: pendingClaimCount },
            { id: "settings", label: "Settings", count: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={adminTab === tab.id}
              className={`orders-tab${adminTab === tab.id ? " active" : ""}`}
              onClick={() => { setAdminTab(tab.id); haptic("light"); }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`orders-tab-count${adminTab === tab.id ? " active" : ""}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {adminTab === "alerts" && adminAlerts.length ? (
        <section className="panel stack task-panel">
          <div className="split">
            <div>
              <span className="brand-kicker">Admin alerts</span>
              <h3>Order and referral notifications</h3>
              <p className="muted">
                Tcash records admin alerts here and also attempts email and World push delivery when configured.
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

      {adminTab === "settings" && (
        <>
      <section className="panel stack task-panel" onChangeCapture={() => { feesEdited.current = true; }}>
        <div className="split">
          <div>
            <h3>Live Price and Fee Control</h3>
            <p className="muted">
              Tcash uses fresh market prices for WLD and USDC.
              Set the KES fee deducted from each sell coin and added to each buy coin.
            </p>
          </div>
          <div className="stack">
            <div className="tag">WLD live: {formatKES(liveRates.WLD)}</div>
            <div className="tag">USDC live: {formatKES(liveRates.USDC)}</div>
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

        <button type="button" className="button" onClick={handleFeeSave} disabled={feeSaving}>
          {feeSaving ? "Saving…" : "Save Fee Settings"}
        </button>
      </section>

      <section className="panel stack task-panel" onChangeCapture={() => { operationsEdited.current = true; }}>
        <div>
          <h3>Mini App Operations</h3>
          <p className="muted">
            Set the live wallet receiver for sell-side payments, the M-Pesa PayBill for buy orders,
            and the support email destination for user help actions.
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
              Sell orders use this receiving wallet for World Pay or a manual World Chain transfer.
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

            <div className="field">
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
            <label htmlFor="supportEmail">Support email</label>
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
            <input id="worldAppId" value={liveSettings.worldAppId || ""} readOnly disabled />
            <span className="muted field-hint">
              Set at deploy time (VITE_WORLD_APP_ID), not editable here — it isn't part of Save Mini
              App Settings below.
            </span>
          </div>
        </div>

        <button type="button" className="button" onClick={handleSettingsSave} disabled={settingsSaving}>
          {settingsSaving ? "Saving…" : "Save Mini App Settings"}
        </button>
      </section>
        </>
      )}

      {adminTab === "orders" && payoutQueue.length ? (
        <section className="panel stack task-panel">
          <div>
            <span className="brand-kicker">Payout Queue</span>
            <h3>Sell payments awaiting operator checks</h3>
            <p className="muted">
              A submitted reference is not proof of receipt. Check the asset, amount, World Chain receiver
              and transaction before paying the saved M-Pesa number. Mark settled only after payout.
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

      {adminTab === "claims" && referralQueue.length ? (
        <section className="panel stack task-panel">
          <div>
            <span className="brand-kicker">Referral claims</span>
            <h3>Referral rewards ready for M-Pesa payout</h3>
            <p className="muted">
              These are historical, self-reported claims. Verify eligibility independently before sending a reward
              directly to the saved M-Pesa number.
            </p>
          </div>
          {referralClaimError ? <div className="error">{referralClaimError}</div> : null}
          <div className="stack">
            {referralQueue.map((claim) => {
              const isUpdating = referralUpdatingId === claim.id;

              return (
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
                        disabled={isUpdating}
                        onClick={() => handleReferralClaimUpdate(claim.id, "approved")}
                      >
                        {isUpdating ? "Saving…" : "Mark Approved"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button"
                      disabled={isUpdating}
                      onClick={() => handleReferralClaimUpdate(claim.id, "paid")}
                    >
                      {isUpdating ? "Saving…" : "Mark Paid"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {adminTab === "orders" && (orders.length ? (
        <section className="order-grid">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order}>
              <div className="action-grid">
                {order.status === "pending" ? (
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={Boolean(orderUpdatingId) || !queueReady}
                    onClick={() => handleStatusUpdate(order, "paid")}
                  >
                    Move to review
                  </button>
                ) : null}
                {order.status === "paid" ? (
                  <button
                    type="button"
                    className="button"
                    disabled={Boolean(orderUpdatingId) || !queueReady}
                    onClick={() => handleStatusUpdate(order, "completed")}
                  >
                    Confirm settled
                  </button>
                ) : null}
                {["pending", "paid"].includes(order.status) ? (
                  <button
                    type="button"
                    className="button-ghost"
                    style={{ color: "var(--error, #b5654f)" }}
                    disabled={Boolean(orderUpdatingId) || !queueReady}
                    onClick={() => handleStatusUpdate(order, "rejected")}
                  >
                    Close order
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => openOrderSupportEmail(order, "support")}
                >
                  Open support draft
                </button>
              </div>
            </OrderCard>
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <h3>{queueReady ? "No orders to review" : "Order queue unavailable"}</h3>
          {!queueReady && <p className="muted">The queue retries automatically. Wait for it to reconnect before reviewing orders.</p>}
        </section>
      ))}

      {adminTab === "alerts" && !adminAlerts.length ? (
        <section className="panel empty-state">
          <h3>No alerts yet</h3>
          <p className="muted">Order and referral notifications will appear here.</p>
        </section>
      ) : null}

      {adminTab === "claims" && !referralQueue.length ? (
        <section className="panel empty-state">
          <h3>No referral claims waiting</h3>
          <p className="muted">Claims ready for M-Pesa payout will appear here.</p>
        </section>
      ) : null}
    </div>
  );
}

export default AdminPage;
