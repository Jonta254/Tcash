export function reviewError(order, status, changes = {}) {
  if (!["pending", "paid"].includes(order.status)) return "This order is already closed. Refresh the queue.";
  if (status === "paid") {
    const reference = changes.paymentReference || order.paymentReference || "";
    if (typeof reference !== "string" || (order.type === "buy" ? !/^[A-Z0-9]{10}$/.test(reference) : !/^0x[a-fA-F0-9]{64}$/.test(reference))) {
      return order.type === "buy" ? "Enter the 10-character M-Pesa payment code." : "Enter the full World Chain transaction hash (0x and 64 hexadecimal characters).";
    }
  } else if (status === "completed") {
    if (order.status !== "paid") return "Move the payment to review before marking it done.";
    const reference = changes.settlementReference || "";
    if (typeof reference !== "string" || (order.type === "sell" ? !/^[A-Z0-9]{10}$/.test(reference) : !/^0x[a-fA-F0-9]{64}$/.test(reference))) {
      return order.type === "sell" ? "Enter the 10-character M-Pesa payout code." : "Enter the full crypto delivery transaction hash (0x and 64 hexadecimal characters).";
    }
    if (reference.toLowerCase() === String(order.paymentReference || "").toLowerCase()) return "Use the outgoing settlement reference, not the customer's incoming payment reference.";
  } else if (status === "rejected") {
    const reason = typeof changes.rejectionReason === "string" ? changes.rejectionReason.trim() : "";
    if (reason.length < 5 || reason.length > 500) return "Enter a rejection reason between 5 and 500 characters.";
  } else return "Unsupported operator action.";
  return "";
}
