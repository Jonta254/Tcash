import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/icons/Icon";
import OrderCard from "../../components/orders/OrderCard";
import {
  fetchSharedAdminOrders,
  commitPaidOrder,
  getCurrentUser,
  getOrdersForCurrentUser,
  openWhatsAppSupport,
  openOrderSupportEmail,
  syncOrderToAdminQueue,
  updateOrder,
} from "../../services";

const TABS = [
  { id: "all",       label: "All" },
  { id: "pending",   label: "Pending" },
  { id: "completed", label: "Settled" },
  { id: "failed",    label: "Closed" },
];

function OrdersPage() {
  const [orders,       setOrders]       = useState(getOrdersForCurrentUser);
  const [activeTab,    setActiveTab]    = useState("all");
  const [paymentCodes, setPaymentCodes] = useState({});
  const [message,      setMessage]      = useState("");
  const user = getCurrentUser();
  const [submittingId, setSubmittingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchSharedAdminOrders();
      if (!result?.ok) throw new Error(result?.message || "Unable to refresh orders.");
      setOrders(getOrdersForCurrentUser());
      setMessage("");
    } catch (error) { setMessage(error.message || "Showing saved history. Reconnect to refresh."); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const foreground = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("online", foreground);
    return () => { document.removeEventListener("visibilitychange", foreground); window.removeEventListener("online", foreground); };
  }, [refresh]);

  const handlePaymentCodeChange = (id, val) =>
    setPaymentCodes((p) => ({ ...p, [id]: val }));

  const handleMarkBuyPaid = async (orderId) => {
    if (submittingId) return;
    const code = (paymentCodes[orderId] || "").trim().toUpperCase();
    if (!code) { setMessage("Enter the M-Pesa code before marking as paid."); return; }
    if (!/^[A-Z0-9]{10}$/.test(code)) { setMessage("Enter the 10-character code from your M-Pesa confirmation SMS."); return; }
    const draft = orders.find(order => order.id === orderId);
    try {
      await commitPaidOrder(draft, { paymentReference: code, status: "paid" });
    } catch (err) {
      setOrders(getOrdersForCurrentUser());
      setMessage(err instanceof Error ? err.message : "Could not record the payment. Keep this order and try submitting the code again.");
      return;
    }
    setOrders(getOrdersForCurrentUser());
    setMessage("Payment code submitted. An operator will confirm and release your crypto.");
  };

  /* counts per tab */
  const counts = useMemo(() => ({
    all:       orders.length,
    pending:   orders.filter((o) => o.status === "pending" || o.status === "paid").length,
    completed: orders.filter((o) => o.status === "completed").length,
    failed:    orders.filter((o) => o.status === "rejected" || o.status === "cancelled").length,
  }), [orders]);

  const filteredOrders = useMemo(() => {
    if (activeTab === "pending")   return orders.filter((o) => o.status === "pending"  || o.status === "paid");
    if (activeTab === "completed") return orders.filter((o) => o.status === "completed");
    if (activeTab === "failed")    return orders.filter((o) => o.status === "rejected"  || o.status === "cancelled");
    return orders;
  }, [activeTab, orders]);

  return (
    <div className="stack page-enter">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <section className="stack tcash-history-heading">
        <div className="orders-header-row">
          <div>
            <span className="sr-only">Transaction history</span>
            <h1 className="tcash-page-title">Your orders</h1>
          </div>
          <div className="orders-header-meta">
            <span className="orders-total-badge">{orders.length}</span>
            {user?.isAdmin && (
              <Link to="/tmpesa-admin" className="button-secondary" style={{ fontSize: "0.8rem", padding: "6px 14px" }}>
                Admin desk
              </Link>
            )}
          </div>
        </div>

        <div className="tcash-history-refresh">
          <span className="muted">An operator reviews each payment before settlement.</span>
          <button type="button" className="button-ghost" disabled={refreshing} onClick={refresh}>{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
        {message && <div className="notice" role="status">{message}</div>}

        {/* Tab filter */}
        <div className="orders-tab-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`orders-tab${activeTab === tab.id ? " active" : ""}`}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span className={`orders-tab-count${activeTab === tab.id ? " active" : ""}`}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── ORDER LIST ─────────────────────────────────────────── */}
      {filteredOrders.length > 0 ? (
        <section className="order-grid">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order}>
              {/* Buy pending: submit M-Pesa code */}
              {order.type === "buy" && order.status === "pending" && (
                <div className="inline-payment-form">
                  <div className="field">
                    <label htmlFor={`mpesa-${order.id}`}>M-Pesa transaction code</label>
                    <input
                      id={`mpesa-${order.id}`}
                      value={paymentCodes[order.id] || ""}
                      onChange={(e) => handlePaymentCodeChange(order.id, e.target.value)}
                      placeholder="ABC123DE45"
                      maxLength={10} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                    />
                  </div>
                  <button
                    type="button"
                    className="button"
                    disabled={Boolean(submittingId)}
                    onClick={() => handleMarkBuyPaid(order.id)}
                  >
                    {submittingId === order.id ? "Submitting…" : "Submit M-Pesa code"}
                  </button>
                </div>
              )}

              {order.status === "pending" && <Link className="button-secondary" to={`/trade?tab=${order.type}&order=${encodeURIComponent(order.id)}`}>Continue payment</Link>}
              <div className="order-card-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => openOrderSupportEmail(order, "support")}
                >
                  Support
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => openOrderSupportEmail(order, "delay")}
                >
                  Delay
                </button>
              </div>
            </OrderCard>
          ))}
        </section>
      ) : (
        <section className="panel orders-empty-state">
          <div className="oes-icon" aria-hidden="true">
            <Icon
              name={activeTab === "completed" ? "check" : activeTab === "failed" ? "close" : "clock"}
              size={26}
              strokeWidth={1.9}
            />
          </div>
          <h3>
            {activeTab === "all"       && "No orders yet"}
            {activeTab === "pending"   && "No pending orders"}
            {activeTab === "completed" && "No completed orders"}
            {activeTab === "failed"    && "No failed orders"}
          </h3>
          <p className="muted">
            {activeTab === "all"
              ? "Start a trade to see your transaction history here."
              : "Switch to All to see your full history."}
          </p>
          {activeTab === "all" && (
            <div className="oes-actions">
              <Link to="/trade?tab=buy"  className="button">Buy crypto</Link>
              <Link to="/trade?tab=sell" className="button-secondary">Sell crypto</Link>
            </div>
          )}
        </section>
      )}

      <Link to="/support" className="button-ghost">Need help with an order? →</Link>

    </div>
  );
}

export default OrdersPage;
