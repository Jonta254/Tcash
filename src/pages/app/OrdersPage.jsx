import { useState } from "react";
import { Link } from "react-router-dom";
import OrderCard from "../../components/orders/OrderCard";
import {
  getCurrentUser,
  getOrdersForCurrentUser,
  openOrderSupportEmail,
  updateOrder,
} from "../../services";

function OrdersPage() {
  const [orders, setOrders] = useState(getOrdersForCurrentUser());
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

  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const paidCount = orders.filter((order) => order.status === "paid").length;
  const completedCount = orders.filter((order) => order.status === "completed").length;

  return (
    <div className="stack">
      <section className="panel stack task-panel">
        <div className="page-section-head">
          <div>
            <span className="brand-kicker">Orders</span>
            <h2>Your activity</h2>
            <p className="muted">
              Track every buy and sell order here. New orders begin as pending, then move to paid
              once you submit proof, and completed after admin confirmation.
            </p>
          </div>
          <div className="mini-metrics">
            <div>
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>{paidCount}</strong>
            </div>
            <div>
              <span>Done</span>
              <strong>{completedCount}</strong>
            </div>
          </div>
        </div>
        {message ? <div className="notice">{message}</div> : null}
        {user?.isAdmin ? <Link to="/admin" className="button-secondary">Open Admin</Link> : null}
      </section>

      {orders.length ? (
        <section className="order-grid">
          {orders.map((order) => (
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
                  Delay on WhatsApp
                </button>
              </div>
            </OrderCard>
          ))}
        </section>
      ) : (
        <section className="panel empty-state stack">
          <h3>No orders yet</h3>
          <p className="muted">Your buy and sell requests will appear here once you place one.</p>
          <div className="action-grid">
            <Link to="/sell" className="button">
              Start Sell Order
            </Link>
            <Link to="/buy" className="button-secondary">
              Start Buy Order
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default OrdersPage;
