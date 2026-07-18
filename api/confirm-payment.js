import { parseCookies, serializeCookie } from "./_lib/cookies.js";
import { allowMethods, readJsonBody, sendJson } from "./_lib/http.js";
import { logEvent, logSecurityEvent } from "./_lib/log.js";
import { getWorldPortalConfig, hasWorldPortalConfig } from "./_lib/world.js";

export default async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const cookies = parseCookies(req);
    const expectedReference = cookies.tmpesa_payment_reference;

    const transactionId = payload?.transactionId || payload?.transaction_id;

    if (!transactionId || !payload?.reference) {
      sendJson(res, 400, { verified: false, error: "Missing transaction payload." });
      return;
    }

    if (!expectedReference || payload.reference !== expectedReference) {
      logSecurityEvent("payment.reference_mismatch", { transactionId });
      sendJson(res, 400, {
        verified: false,
        error: "Payment reference mismatch.",
      });
      return;
    }

    if (!hasWorldPortalConfig()) {
      sendJson(res, 200, {
        verified: false,
        transactionStatus: "verification_unconfigured",
        reference: payload.reference,
        transactionId,
        warning: "APP_ID and DEV_PORTAL_API_KEY must be configured to verify World payments.",
      });
      return;
    }

    const { appId, apiKey } = getWorldPortalConfig();
    const response = await fetch(
      `https://developer.worldcoin.org/api/v2/minikit/transaction/${transactionId}?app_id=${appId}&type=payment`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    const transaction = await response.json();

    if (!response.ok) {
      sendJson(res, response.status, {
        verified: false,
        error: transaction?.message || "Unable to verify payment with World.",
      });
      return;
    }

    res.setHeader(
      "Set-Cookie",
      serializeCookie("tmpesa_payment_reference", "", {
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
      }),
    );

    // "mined" = confirmed on-chain
    // "pending" / "unknown" = submitted but not yet indexed — still a valid payment
    // anything else (e.g. "failed", "reverted") = genuinely failed
    const status = transaction?.transaction_status || "unknown";
    const submitted = ["mined", "pending", "unknown"].includes(status);

    logEvent("payment.confirmed", { transactionId, status, verified: submitted });

    sendJson(res, 200, {
      verified: submitted,
      transactionStatus: status,
      reference: payload.reference,
      transactionId,
      transaction,
    });
  } catch (error) {
    sendJson(res, 500, {
      verified: false,
      error: error instanceof Error ? error.message : "Unable to confirm payment.",
    });
  }
}
