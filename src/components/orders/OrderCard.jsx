import Icon from "../icons/Icon";
import { getCurrentUser } from "../../services";
import StatusPill from "./StatusPill";

function fmt(date) {
  return new Date(date).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const STAGE = {
  completed: 3,
  paid:      2,
  rejected:  0,
  cancelled: 0,
};

function OrderCard({ order, children }) {
  const user     = getCurrentUser();
  const isSell   = order.type === "sell";
  const stage    = STAGE[order.status] ?? 1;
  const isFailed = order.status === "rejected" || order.status === "cancelled";

  return (
    <article className={`order-card stack${isFailed ? " order-card-failed" : ""}`}>

      {/* ── Card header ─────────────────────────────────────── */}
      <div className="oc-header">
        <div className="oc-type-block">
          <span className={`oc-type-badge oc-type-${order.type}`}>
            <Icon name={order.type === "buy" ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.6} />
            {order.type === "buy" ? "Buy" : "Sell"}
          </span>
          <h3 className="oc-title">
            {order.cryptoAmount} {order.asset}
          </h3>
        </div>
        <StatusPill status={order.status} />
      </div>

      {/* ── Key figures ─────────────────────────────────────── */}
      <div className="oc-figures">
        <div className="oc-fig">
          <span>{isSell ? "KES payout" : "KES to pay"}</span>
          <strong>KES {Number(order.kesAmount).toLocaleString()}</strong>
        </div>
        <div className="oc-fig">
          <span>Asset</span>
          <strong>{order.cryptoAmount} {order.asset}</strong>
        </div>
        {order.payoutPhoneNumber && (
          <div className="oc-fig">
            <span>M-Pesa</span>
            <strong>{order.payoutPhoneNumber}</strong>
          </div>
        )}
        {order.paymentReference && (
          <div className="oc-fig">
            <span>Reference</span>
            <strong className="oc-ref">{order.paymentReference}</strong>
          </div>
        )}
        {order.destinationUsername && (
          <div className="oc-fig">
            <span>World user</span>
            <strong>@{order.destinationUsername}</strong>
          </div>
        )}
      </div>

      {/* ── Admin-only details ──────────────────────────────── */}
      {user?.isAdmin && (
        <div className="oc-admin-meta">
          {order.userPhone         && <span>Phone: {order.userPhone}</span>}
          {order.userWalletAddress && <span>Wallet: {order.userWalletAddress}</span>}
          {order.userLabel         && <span>User: {order.userLabel}</span>}
          {order.humanVerificationStatus && (
            <span>
              Verified: {order.humanVerificationStatus}
              {order.humanVerificationLevel ? ` (${order.humanVerificationLevel})` : ""}
            </span>
          )}
        </div>
      )}

      {/* ── Timeline ────────────────────────────────────────── */}
      {!isFailed ? (
        <div className="oc-timeline" aria-label="Order progress">
          {["Placed", "Under review", "Completed"].map((label, i) => (
            <div key={label} className={`oc-step${stage > i ? " done" : stage === i + 1 ? " active" : ""}`}>
              <div className="oc-step-dot">
                {stage > i ? <span className="oc-step-tick"><Icon name="check" size={13} strokeWidth={2.6} /></span> : null}
              </div>
              <small>{label}</small>
            </div>
          ))}
          <div className="oc-timeline-line" />
        </div>
      ) : (
        <div className="oc-failed-note">
          Order {order.status} — contact support if you need help.
        </div>
      )}

      {/* ── Footer timestamp ────────────────────────────────── */}
      <div className="oc-footer">
        <span className="oc-date">{fmt(order.createdAt)}</span>
        {order.updatedAt && order.updatedAt !== order.createdAt && (
          <span className="oc-date">Updated {fmt(order.updatedAt)}</span>
        )}
      </div>

      {children}
    </article>
  );
}

export default OrderCard;
