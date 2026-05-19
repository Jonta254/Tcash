const STATUS_LABELS = {
  pending: "Pending",
  paid: "Reviewing",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function StatusPill({ status }) {
  return <span className={`status-pill ${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export default StatusPill;
