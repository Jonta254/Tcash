import { useState } from "react";
import Icon from "../icons/Icon";
import { formatCryptoAmount, formatKES, getCurrentUser, tenderHaptics } from "../../services";
import StatusPill from "./StatusPill";

function fmt(date) {
  return new Date(date).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const UPDATE_LABEL = {
  paid: "Reviewing since",
  completed: "Settled",
  rejected: "Closed",
  cancelled: "Closed",
};

/*
 * A ledger entry, not a card. Collapsed, it's a single row — identical
 * shape to Home's recent-activity lines, so History reads as more of
 * that journal rather than a second, different-looking list. Tapping
 * it grows the row in place to reveal the full record: no modal, no
 * navigation, no separate screen. Orders still needing the user's own
 * next action (a pending order waiting on an M-Pesa code or a manual
 * tx hash) open by default — the same inline form that used to always
 * be visible stays exactly that reachable; only settled/closed history
 * defaults to collapsed, which is the actual improvement, not a
 * relearned procedure.
 */
function OrderCard({ order, children }) {
  const user = getCurrentUser();
  const isFailed = order.status === "rejected" || order.status === "cancelled";
  const needsUserAction = order.status === "pending";
  const [open, setOpen] = useState(needsUserAction);

  const toggle = () => {
    if (open) {
      tenderHaptics.select();
    } else if (order.status === "pending" || order.status === "paid") {
      tenderHaptics.pendingSettlement();
    } else {
      tenderHaptics.select();
    }
    setOpen((current) => !current);
  };

  const hasUpdate = order.updatedAt && order.updatedAt !== order.createdAt;

  return (
    <article className={`tdr-ledger-entry${isFailed ? " tdr-ledger-entry-failed" : ""}`}>
      <button
        type="button"
        className="tdr-ledger-entry-row"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className={`tdr-ledger-icon tdr-ledger-icon-${order.type}`} aria-hidden="true">
          <Icon name={order.type === "buy" ? "arrowUp" : "arrowDown"} size={13} strokeWidth={2.2} />
        </span>
        <div className="tdr-ledger-mid">
          <span className="tdr-ledger-title">
            {order.type === "buy" ? "Buy" : "Sell"} {formatCryptoAmount(order.cryptoAmount)} {order.asset}
          </span>
          <span className="tdr-ledger-date">{fmt(order.createdAt)}</span>
        </div>
        <div className="tdr-ledger-right">
          <span className="tdr-ledger-amt">{formatKES(order.kesAmount)}</span>
          <StatusPill status={order.status} />
        </div>
      </button>

      <div className={`tdr-ledger-reveal${open ? " open" : ""}`}>
        <div className="tdr-ledger-reveal-inner">
          <div className="tdr-receipt-lines">
            <div className="tdr-receipt-line">
              <span>{order.type === "sell" ? "KES payout" : "KES to pay"}</span>
              <strong>{formatKES(order.kesAmount)}</strong>
            </div>
            <div className="tdr-receipt-line">
              <span>Asset</span>
              <strong>{formatCryptoAmount(order.cryptoAmount)} {order.asset}</strong>
            </div>
            {order.payoutPhoneNumber && (
              <div className="tdr-receipt-line">
                <span>M-Pesa</span>
                <strong>{order.payoutPhoneNumber}</strong>
              </div>
            )}
            {order.paymentReference && (
              <div className="tdr-receipt-line">
                <span>Reference</span>
                <strong>{order.paymentReference}</strong>
              </div>
            )}
            {order.destinationUsername && (
              <div className="tdr-receipt-line">
                <span>World user</span>
                <strong>@{order.destinationUsername}</strong>
              </div>
            )}
          </div>

          {user?.isAdmin && (
            <div className="oc-admin-meta">
              {order.userPhone && <span>Phone: {order.userPhone}</span>}
              {order.userWalletAddress && <span>Wallet: {order.userWalletAddress}</span>}
              {order.userLabel && <span>User: {order.userLabel}</span>}
              {order.humanVerificationStatus && (
                <span>
                  Verified: {order.humanVerificationStatus}
                  {order.humanVerificationLevel ? ` (${order.humanVerificationLevel})` : ""}
                </span>
              )}
            </div>
          )}

          {/* journal — real recorded timestamps only, never a fabricated
              per-stage progress illustration */}
          <div className="tdr-receipt-lines">
            <div className="tdr-receipt-line">
              <span>Placed</span>
              <strong>{fmt(order.createdAt)}</strong>
            </div>
            {hasUpdate && (
              <div className="tdr-receipt-line">
                <span>{UPDATE_LABEL[order.status] || "Updated"}</span>
                <strong>{fmt(order.updatedAt)}</strong>
              </div>
            )}
          </div>
          {isFailed && (
            <p className="muted tdr-ledger-closed-note">
              Order {order.status} — contact support if you need help.
            </p>
          )}

          {children}
        </div>
      </div>
    </article>
  );
}

export default OrderCard;
