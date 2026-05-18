export async function notifyAdminOrderCreated(order) {
  try {
    const response = await fetch("/api/notify-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ order }),
    });

    return response.json().catch(() => ({ notified: false }));
  } catch {
    return { notified: false, error: "Notification request failed." };
  }
}

export async function notifyWorldUserOrderCreated(order) {
  if (!order?.userWalletAddress) {
    return { sent: false, skipped: true, reason: "No World wallet address on order." };
  }

  try {
    const response = await fetch("/api/send-world-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress: order.userWalletAddress,
        title: "TMpesa order received",
        message:
          order.type === "sell"
            ? `Your ${order.asset} sell order is pending review. Open TMpesa to track payout progress.`
            : `Your ${order.asset} buy order is pending review. Open TMpesa to track payment progress.`,
        miniAppPath: "/orders",
      }),
    });

    return response.json().catch(() => ({ sent: false }));
  } catch {
    return { sent: false, error: "World notification request failed." };
  }
}
