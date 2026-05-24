import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import OrderCard from "../../components/orders/OrderCard";
import {
  getCurrentUser,
  getOrdersForCurrentUser,
  openWhatsAppSupport,
  openOrderSupportEmail,
  updateOrder,
} from "../../services";

function OrdersPage() {
  const [orders, setOrders] = useState(getOrdersForCurrentUser());
  const [activeTab, setActiveTab] = useState("all");
  const [paymentCodes, setPaymentCodes] = useState({});
  const [message, setMessage] = useState("");
  const user = getCurrentUser();

  const handlePaymentCodeChange = (orderId, value) => {
    setPaymentCodes((current) => ({ ...current, [orderId]: value }));
  };

  const handleMarkBuyPaid = (orderId) => {
    const code = (paymentCodes[orderId] || "").trim().toUpperCase();

    if (!code) {
      setMessage("Enter the M-Pesa code before marking the buy order as paid.");
      return;
    }

    updateOrder(orderId, { paymentReference: code, status: "paid" });
    setOrders(getOrdersForCurrentUser());
    setMessage("Payment code submitted. Admin will confirm and send your crypto.");
  };

  const filteredOrders = useMemo(() => {
    if (activeTab === "pending") {
      return orders.filter((order) => order.status === "pending" || order.status === "paid");
    }

    if (activeTab === "completed") {
      return orders.filter((order) => order.status === "completed");
    }

    if (activeTab === "failed") {
      return orders.filter((order) => order.status === "rejected" || order.status === "cancelled");
    }

    return orders;
  }, [activeTab, orders]);

  return (
    <div className="stack">
      <section className="panel stack task-panel">
        <div className="page-section-head compact-page-head">
          <div>
            <span className="brand-kicker">History</span>
            <h2>Transaction history</h2>
            <p className="muted">Your buy and sell orders appear here.</p>
          </div>
        </div>
        {message ? <div className="notice">{message}</div> : null}
        <div className="history-tab-row">
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "completed", label: "Complete" },
            { id: "failed", label: "Failed" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`history-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {user?.isAdmin ? (
          <Link to="/tmpesa-admin" className="text-link">
            Admin desk
          </Link>
        ) : null}
      </section>

      {orders.length ? (
        <section className="support-footer support-footer-emphasis">
          <div>
            <strong>Payment delay support</strong>
            <p>Open WhatsApp for urgent help with a delayed payment or payout.</p>
          </div>
          <button
            type="button"
            className="button"
            onClick={() =>
              openWhatsAppSupport({
                message: [
                  "Hello TMpesa support,",
                  "",
                  "I have already placed an order and my payment or settlement is delayed.",
                  "",
                  `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
                ].join("\n"),
              })
            }
          >
            Delay
          </button>
        </section>
      ) : null}

      {filteredOrders.length ? (
        <section className="order-grid">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order}>
              {order.type === "buy" && order.status === "pending" ? (
                <div className="inline-payment-form">
                  <div className="field">
                    <label htmlFor={`mpesa-${order.id}`}>M-Pesa transaction code</label>
                    <input
                      id={`mpesa-${order.id}`}
                      value={paymentCodes[order.id] || ""}
                      onChange={(event) => handlePaymentCodeChange(order.id, event.target.value)}
                      placeholder="QWE123XYZ"
                    />
                  </div>
                  <button
                    type="button"
                    className="button"
                    onClick={() => handleMarkBuyPaid(order.id)}
                  >
                    I Have Paid
                  </button>
                </div>
              ) : null}
              <div className="button-row">
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
        <section className="panel empty-state stack">
          <h3>No transactions yet</h3>
          <p className="muted">Your buy and sell history will appear here.</p>
          <div className="action-grid">
            <Link to="/trade?tab=buy" className="button">
              Buy crypto
            </Link>
            <Link to="/trade?tab=sell" className="button-secondary">
              Sell crypto
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default OrdersPage;
