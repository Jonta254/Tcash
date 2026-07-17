import Icon from "../icons/Icon";

const STATUS_LABELS = {
  pending: "Pending",
  paid: "Reviewing",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/*
 * Trust signal, not just a label: "completed" carries the stamp mark
 * (the same ring+check used for settlement everywhere else in the app —
 * see Icon.jsx) so a settled order is recognizable by shape alone, not
 * just color. "pending"/"paid" carry a small motion dot — still moving,
 * not final. Rejected/cancelled get neither — deliberately inert.
 */
function StatusPill({ status }) {
  return (
    <span className={`status-pill ${status}`}>
      {status === "completed" ? (
        <Icon name="check" size={12} strokeWidth={1.9} />
      ) : status === "pending" || status === "paid" ? (
        <span className="status-pill-motion" aria-hidden="true" />
      ) : null}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default StatusPill;
