import { getCurrentUser } from "../../services";
import StatusPill from "./StatusPill";

function formatDate(dateValue) {
  return new Date(dateValue).toLocaleString();
}

function OrderCard({ order, children }) {
  const user = getCurrentUser();
  const isSell = order.type === "sell";
  const currentStage =
    order.status === "completed"
      ? 3
      : order.status === "paid"
        ? 2
        : order.status === "rejected" || order.status === "cancelled"
          ? 0
          : 1;

  return (
    <article className="order-card stack">
      <div className="split">
        <div>
          <span className="tag">{order.type}</span>
          <h3>
            {order.cryptoAmount} {order.asset}
          </h3>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="detail-grid">
        <div className="detail-item">
          <span>{isSell ? "KES payout" : "KES to pay"}</span>
          <strong>KES {order.kesAmount.toLocaleString()}</strong>
        </div>
        <div className="detail-item">
          <span>Asset amount</span>
          <strong>
            {order.cryptoAmount} {order.asset}
          </strong>
        </div>
        {order.userLabel ? (
          <div className="detail-item">
            <span>User</span>
            <strong>{order.userLabel}</strong>
          </div>
        ) : null}
        {order.destinationUsername ? (
          <div className="detail-item">
            <span>World username</span>
            <strong>@{order.destinationUsername}</strong>
          </div>
        ) : null}
        {order.payoutPhoneNumber ? (
          <div className="detail-item">
            <span>M-Pesa payout</span>
            <strong>{order.payoutPhoneNumber}</strong>
          </div>
        ) : null}
        {order.paymentReference ? (
          <div className="detail-item">
            <span>Reference</span>
            <strong>{order.paymentReference}</strong>
          </div>
        ) : null}
        {user?.isAdmin && order.humanVerificationStatus ? (
          <div className="detail-item">
            <span>Human check</span>
            <strong>
              {order.humanVerificationStatus}
              {order.humanVerificationLevel ? ` (${order.humanVerificationLevel})` : ""}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="order-meta">
        {user?.isAdmin && order.userPhone ? <span>Login phone: {order.userPhone}</span> : null}
        {user?.isAdmin && order.userWalletAddress ? <span>User wallet: {order.userWalletAddress}</span> : null}
        {user?.isAdmin && order.walletAddress ? <span>Delivery wallet: {order.walletAddress}</span> : null}
        {user?.isAdmin && order.paymentMethod ? <span>Method: {order.paymentMethod}</span> : null}
        {user?.isAdmin && order.paymentSummary ? <span>Payment note: {order.paymentSummary}</span> : null}
        {user?.isAdmin && order.paymentVerificationStatus ? <span>Verification: {order.paymentVerificationStatus}</span> : null}
        <span>Created: {formatDate(order.createdAt)}</span>
      </div>

      <div className="order-timeline" aria-label="Order timeline">
        <div className={`order-timeline-step${currentStage >= 1 ? " active" : ""}`}>
          <span />
          <small>Placed</small>
        </div>
        <div className={`order-timeline-step${currentStage >= 2 ? " active" : ""}`}>
          <span />
          <small>Manual Review</small>
        </div>
        <div className={`order-timeline-step${currentStage >= 3 ? " active" : ""}`}>
          <span />
          <small>Completed</small>
        </div>
      </div>

      {children}
    </article>
  );
}

export default OrderCard;
