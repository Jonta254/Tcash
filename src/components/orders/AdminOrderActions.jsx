import { useState } from "react";
import { reviewError } from "../../../shared/orderReview.js";

export default function AdminOrderActions({ order, disabled, onUpdate }) {
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!["pending", "paid"].includes(order.status)) return null;
  const pending = order.status === "pending";
  const mpesa = pending ? order.type === "buy" : order.type === "sell";
  const submit = async (status) => {
    const code = mpesa ? reference.trim().toUpperCase() : reference.trim();
    const changes = status === "rejected" ? { rejectionReason: reason.trim() }
      : pending ? { paymentReference: order.paymentReference || code }
      : { settlementReference: code };
    const message = reviewError(order, status, changes);
    setError(message);
    if (!message) await onUpdate(order, status, changes);
  };
  return <div className="stack">
    {(!pending || !order.paymentReference) && <label className="field">
      <span>{pending ? "Incoming payment reference" : mpesa ? "M-Pesa payout code" : "Crypto delivery transaction hash"}</span>
      <input value={reference} onChange={event => { setReference(event.target.value); setError(""); }} maxLength={66} autoComplete="off" spellCheck={false} disabled={disabled} />
    </label>}
    <p className="muted">{pending ? "Check this reference against the actual incoming payment. A code alone does not prove receipt." : "Record the outgoing transfer after verifying the amount and recipient. Marking done does not send funds."}</p>
    <button type="button" className="button" disabled={disabled} onClick={() => submit(pending ? "paid" : "completed")}>{pending ? "Move to review" : "Mark done — settled"}</button>
    <label className="field"><span>Rejection reason (visible to customer)</span><textarea value={reason} onChange={event => { setReason(event.target.value); setError(""); }} maxLength={500} disabled={disabled} /></label>
    <p className="muted">Rejecting does not refund a payment. If funds were received, arrange and record their return with support.</p>
    <button type="button" className="button-ghost" disabled={disabled} onClick={() => submit("rejected")}>Reject order</button>
    {error && <p role="alert" className="error">{error}</p>}
  </div>;
}
