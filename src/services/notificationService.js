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
            ? `Hello \${username}, your ${order.asset} sell order is pending review. Open TMpesa to track payout progress.`
            : `Hello \${username}, your ${order.asset} buy order is pending review. Open TMpesa to track payment progress.`,
        miniAppPath: "/orders",
      }),
    });

    return response.json().catch(() => ({ sent: false }));
  } catch {
    return { sent: false, error: "World notification request failed." };
  }
}

export async function notifyWorldUserOrderStatus(order, status) {
  if (!order?.userWalletAddress) {
    return { sent: false, skipped: true, reason: "No World wallet address on order." };
  }

  const copyByStatus = {
    paid: {
      title: "TMpesa order under review",
      message:
        order.type === "sell"
          ? "Hello ${username}, your sell order is now under manual review. TMpesa will notify you when payout is completed."
          : "Hello ${username}, your buy payment is now under manual review. TMpesa will notify you when crypto is sent.",
    },
    completed: {
      title: "TMpesa order completed",
      message:
        order.type === "sell"
          ? "Hello ${username}, your sell order is completed and KES payout has been processed."
          : "Hello ${username}, your buy order is completed and crypto has been released to your wallet.",
    },
    rejected: {
      title: "TMpesa order update",
      message: "Your order was marked as rejected. Open TMpesa support for the next step.",
    },
  };

  const copy = copyByStatus[status];

  if (!copy) {
    return { sent: false, skipped: true, reason: "No notification copy for this status." };
  }

  try {
    const response = await fetch("/api/send-world-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress: order.userWalletAddress,
        title: copy.title,
        message: copy.message,
        miniAppPath: "/orders",
      }),
    });

    return response.json().catch(() => ({ sent: false }));
  } catch {
    return { sent: false, error: "World notification request failed." };
  }
}

export async function notifyAdminReferralEvent(payload) {
  try {
    const response = await fetch("/api/notify-referral", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return response.json().catch(() => ({ notified: false }));
  } catch {
    return { notified: false, error: "Referral notification request failed." };
  }
}
