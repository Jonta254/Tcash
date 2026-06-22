import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import OrderCard from "../../components/orders/OrderCard";
import {
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
  { id: "completed", label: "Done" },
  { id: "failed",    label: "Failed" },
];

function OrdersPage() {
  const [orders,       setOrders]       = useState(getOrdersForCurrentUser);
  const [activeTab,    setActiveTab]    = useState("all");
  const [paymentCodes, setPaymentCodes] = useState({});
  const [message,      setMessage]      = useState("");
  const user = getCurrentUser();

  const handlePaymentCodeChange = (id, val) =>
    setPaymentCodes((p) => ({ ...p, [id]: val }));

  const handleMarkBuyPaid = async (orderId) => {
    const code = (paymentCodes[orderId] || "").trim().toUpperCase();
    if (!code) { setMessage("Enter the M-Pesa code before marking as paid."); return; }
    const updated = updateOrder(orderId, { paymentReference: code, status: "paid" }, null, { sync: false });
    try {
      await syncOrderToAdminQueue(updated);
    } catch (err) {
      setOrders(getOrdersForCurrentUser());
      setMessage(err instanceof Error ? err.message : "Saved locally — could not notify admin.");
      return;
    }
    setOrders(getOrdersForCurrentUser());
    setMessage("Payment code submitted. Admin will confirm and release your crypto.");
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
      <section className="panel stack orders-header-panel">
        <div className="orders-header-row">
          <div>
            <span className="brand-kicker">Transaction history</span>
            <h2>Your orders</h2>
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

        {message && <div className="notice">{message}</div>}

        {/* Tab filter */}
        <div className="orders-tab-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`orders-tab${activeTab === tab.id ? " active" : ""}`}
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
                      placeholder="QWE123XYZ"
                    />
                  </div>
                  <button
                    type="button"
                    className="button"
                    onClick={() => handleMarkBuyPaid(order.id)}
                  >
                    I have paid — submit code
                  </button>
                </div>
              )}

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
            {activeTab === "completed" ? "✓" : activeTab === "failed" ? "✕" : activeTab === "pending" ? "⏳" : "◷"}
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

      {/* ── DELAY SUPPORT FOOTER ───────────────────────────────── */}
      {orders.length > 0 && (
        <section className="support-footer support-footer-emphasis">
          <div>
            <strong>Payment delay?</strong>
            <p>Open WhatsApp for urgent help with a delayed payment or payout.</p>
          </div>
          <button
            type="button"
            className="button"
            onClick={() =>
              openWhatsAppSupport({
                message: [
                  "Hello Tcash support,",
                  "",
                  "My payment or settlement is delayed.",
                  "",
                  `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
                ].join("\n"),
              })
            }
          >
            WhatsApp
          </button>
        </section>
      )}

    </div>
  );
}

export default OrdersPage;
