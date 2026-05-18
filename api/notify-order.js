import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";

const ADMIN_EMAIL = "brianokindo2022@gmail.com";
const FROM_EMAIL = "TMpesa <onboarding@resend.dev>";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildOrderEmail(order) {
  const isSell = order.type === "sell";
  const rows = [
    ["Order ID", order.id],
    ["Type", order.type?.toUpperCase()],
    ["Asset", order.asset],
    ["Crypto Amount", order.cryptoAmount],
    [isSell ? "KES Payout" : "KES To Pay", `KES ${Number(order.kesAmount || 0).toLocaleString()}`],
    ["Status", order.status],
    ["User", order.userLabel],
    ["Login Phone", order.userPhone],
    ["M-Pesa Payout", order.payoutPhoneNumber || order.userMpesaPhoneNumber],
    ["World Username", order.destinationUsername ? `@${order.destinationUsername}` : ""],
    ["Wallet", order.walletAddress || order.userWalletAddress],
    ["Created", order.createdAt],
  ].filter(([, value]) => value);

  const title = isSell
    ? "New sell order needs M-Pesa payout after World payment"
    : "New buy order needs M-Pesa payment confirmation";

  return {
    subject: `TMpesa ${order.type?.toUpperCase()} order - ${order.cryptoAmount} ${order.asset}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0f1a;color:#f5f7ff;padding:24px">
        <div style="max-width:620px;margin:0 auto;background:#111827;border:1px solid #273348;border-radius:18px;padding:22px">
          <p style="color:#9fb1d1;margin:0 0 8px">TMpesa admin notification</p>
          <h1 style="font-size:22px;line-height:1.25;margin:0 0 18px">${escapeHtml(title)}</h1>
          <table style="width:100%;border-collapse:collapse">
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <td style="padding:10px;border-top:1px solid #273348;color:#9fb1d1">${escapeHtml(label)}</td>
                    <td style="padding:10px;border-top:1px solid #273348;text-align:right;color:#ffffff">${escapeHtml(value)}</td>
                  </tr>
                `,
              )
              .join("")}
          </table>
          <p style="color:#9fb1d1;margin:18px 0 0">
            Open the TMpesa admin dashboard to review and complete this order.
          </p>
        </div>
      </div>
    `,
  };
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const { order } = await readJsonBody(req);

    if (!order?.id || !order?.type) {
      sendJson(res, 400, { notified: false, error: "Missing order details." });
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      sendJson(res, 200, {
        notified: false,
        skipped: true,
        reason: "RESEND_API_KEY is not configured.",
      });
      return;
    }

    const email = buildOrderEmail(order);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `tmpesa-order-${order.id}`,
      },
      body: JSON.stringify({
        from: process.env.ORDER_EMAIL_FROM || FROM_EMAIL,
        to: process.env.ORDER_NOTIFICATION_EMAIL || ADMIN_EMAIL,
        subject: email.subject,
        html: email.html,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      sendJson(res, response.status, {
        notified: false,
        error: payload?.message || "Unable to send order notification.",
      });
      return;
    }

    sendJson(res, 200, { notified: true, id: payload.id });
  } catch (error) {
    sendJson(res, 500, {
      notified: false,
      error: error instanceof Error ? error.message : "Unable to notify admin.",
    });
  }
}
