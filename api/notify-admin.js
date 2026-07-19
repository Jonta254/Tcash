import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";

// Combines what were two near-identical endpoints (notify-order,
// notify-referral) into one — both just build an admin notification
// email via Resend and differ only in which fields go in the table.
// Merged specifically to stay under Vercel's per-deployment serverless
// function count on the Hobby plan, not for any architectural reason;
// dispatched by payload shape (order vs. eventType) rather than an
// explicit type field, so the two existing call sites in
// notificationService.js didn't need their payload shapes changed.

const ADMIN_EMAIL = "brianokindo2022@gmail.com";
const FROM_EMAIL = "Tcash <onboarding@resend.dev>";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEmail({ kicker, title, rows }) {
  return `
    <div style="font-family:Arial,sans-serif;background:#0b0f1a;color:#f5f7ff;padding:24px">
      <div style="max-width:620px;margin:0 auto;background:#111827;border:1px solid #273348;border-radius:18px;padding:22px">
        <p style="color:#9fb1d1;margin:0 0 8px">${escapeHtml(kicker)}</p>
        <h1 style="font-size:22px;line-height:1.25;margin:0 0 18px">${escapeHtml(title)}</h1>
        <table style="width:100%;border-collapse:collapse">
          ${rows
            .filter(([, value]) => value)
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
          Open the Tcash admin dashboard to review and complete this.
        </p>
      </div>
    </div>
  `;
}

function buildOrderEmail(order) {
  const isSell = order.type === "sell";
  const title = isSell
    ? "New sell order needs M-Pesa payout after World payment"
    : "New buy order needs M-Pesa payment confirmation";

  return {
    subject: `Tcash ${order.type?.toUpperCase()} order - ${order.cryptoAmount} ${order.asset}`,
    idempotencyKey: `tmpesa-order-${order.id}`,
    html: renderEmail({
      kicker: "Tcash admin notification",
      title,
      rows: [
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
      ],
    }),
  };
}

function buildReferralEmail(payload) {
  const subject =
    payload.eventType === "milestone"
      ? `Tcash referral milestone reached - ${payload.eligibleRewardKes ? `KES ${payload.eligibleRewardKes}` : "reward pending"}`
      : "Tcash new referral signup";

  return {
    subject,
    idempotencyKey: `tmpesa-referral-${payload.eventType}-${payload.referralCode}-${payload.referredWalletAddress || payload.referredUsername || payload.createdAt}`,
    html: renderEmail({
      kicker: "Tcash referral notification",
      title: subject,
      rows: [
        ["Event", payload.eventType],
        ["Referrer", payload.referrerUsername ? `@${payload.referrerUsername}` : payload.referrerLabel],
        ["Referral Code", payload.referralCode],
        ["Referred User", payload.referredUsername ? `@${payload.referredUsername}` : payload.referredLabel],
        ["Referred Wallet", payload.referredWalletAddress],
        ["Referrer M-Pesa", payload.referrerMpesaPhoneNumber],
        ["Activated Users", payload.activatedUsers],
        ["Referred Users", payload.referredUsers],
        ["Eligible Reward", payload.eligibleRewardKes ? `KES ${payload.eligibleRewardKes}` : ""],
        ["Created", payload.createdAt],
      ],
    }),
  };
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const payload = await readJsonBody(req);
    let email;
    let errorMessage;

    if (payload?.order?.id && payload?.order?.type) {
      email = buildOrderEmail(payload.order);
    } else if (payload?.eventType && payload?.referralCode) {
      email = buildReferralEmail(payload);
    } else {
      errorMessage = payload?.order
        ? "Missing order details."
        : "Missing referral event details.";
    }

    if (!email) {
      sendJson(res, 400, { notified: false, error: errorMessage });
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

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.ORDER_EMAIL_FROM || FROM_EMAIL,
        to: process.env.ORDER_NOTIFICATION_EMAIL || ADMIN_EMAIL,
        subject: email.subject,
        html: email.html,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      sendJson(res, response.status, {
        notified: false,
        error: result?.message || "Unable to send notification.",
      });
      return;
    }

    sendJson(res, 200, { notified: true, id: result.id });
  } catch (error) {
    sendJson(res, 500, {
      notified: false,
      error: error instanceof Error ? error.message : "Unable to notify admin.",
    });
  }
}
