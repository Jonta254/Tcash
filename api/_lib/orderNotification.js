const ADMIN_WORLD_WALLET = "0x6588e8765c495a9d44e93b0293aedd7ecd6167fc";

export async function readNotificationOrder(id) {
  if (typeof id !== "string" || !id || id.length > 128) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Order notifications are unavailable.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["HGET", "tmpesa:orders", id]),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error("Could not read the saved order.");
  if (!data.result) return null;
  const stored = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  return stored.order || stored;
}

export function notificationForOrder(order, recipient) {
  const wallet = String(recipient || "").toLowerCase();
  const owner = String(order.userWalletAddress || "").toLowerCase();
  if (wallet === ADMIN_WORLD_WALLET && wallet !== owner) {
    return {
      walletAddress: ADMIN_WORLD_WALLET,
      title: "Tcash order update",
      message: `A ${order.asset} ${order.type} order is ${order.status}. Open the operator desk to review its saved details.`,
      miniAppPath: "/tmpesa-admin",
    };
  }
  if (!owner || wallet !== owner) return null;
  const copy = {
    pending: ["Tcash order saved", "Review your saved payment instructions in Tcash before paying."],
    paid: ["Tcash payment under review", "Your payment reference was submitted. An operator must check it before settlement."],
    completed: ["Tcash order settled", "The operator marked your order settled. Open History to check the record."],
    rejected: ["Tcash order closed", "Your order was closed. Contact Tcash support if you sent funds."],
    cancelled: ["Tcash order cancelled", "Open History for your saved order details. Contact support if you sent funds."],
  }[order.status];
  if (!copy) return null;
  return { walletAddress: order.userWalletAddress, title: copy[0], message: copy[1], miniAppPath: "/orders" };
}
