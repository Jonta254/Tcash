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

function buildReferralEmail(payload) {
  const rows = [
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
  ].filter(([, value]) => value);

  const subject =
    payload.eventType === "milestone"
      ? `TMpesa referral milestone reached - ${payload.eligibleRewardKes ? `KES ${payload.eligibleRewardKes}` : "reward pending"}`
      : "TMpesa new referral signup";

  return {
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0b0f1a;color:#f5f7ff;padding:24px">
        <div style="max-width:620px;margin:0 auto;background:#111827;border:1px solid #273348;border-radius:18px;padding:22px">
          <p style="color:#9fb1d1;margin:0 0 8px">TMpesa referral notification</p>
          <h1 style="font-size:22px;line-height:1.25;margin:0 0 18px">${escapeHtml(subject)}</h1>
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
            Review this referral event in TMpesa profile/admin and settle any eligible M-Pesa reward manually.
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
    const payload = await readJsonBody(req);

    if (!payload?.eventType || !payload?.referralCode) {
      sendJson(res, 400, { notified: false, error: "Missing referral event details." });
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

    const email = buildReferralEmail(payload);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `tmpesa-referral-${payload.eventType}-${payload.referralCode}-${payload.referredWalletAddress || payload.referredUsername || payload.createdAt}`,
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
        error: result?.message || "Unable to send referral notification.",
      });
      return;
    }

    sendJson(res, 200, { notified: true, id: result.id });
  } catch (error) {
    sendJson(res, 500, {
      notified: false,
      error: error instanceof Error ? error.message : "Unable to notify referral event.",
    });
  }
}
