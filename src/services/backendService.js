const REQUEST_TIMEOUT_MS = 12000;

// Bounded fetch so flaky mobile networks inside World App can never hang a
// trade flow forever; callers get a normal rejection they already handle.
async function fetchWithTimeout(url, options = {}) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  try {
    return await fetch(url, { ...options, signal: controller?.signal });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error || payload?.message || "Tcash could not reach the secure server. Please try again.",
    );
    // Callers need this to tell "the server explicitly rejected this" (409
    // conflict, 403 unauthorized) apart from a transient network failure —
    // the former must never be silently retried later, the latter should be.
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function requestServerNonce() {
  const response = await fetchWithTimeout("/api/nonce", {
    credentials: "include",
  }).catch(() => {
    throw new Error("Tcash secure login is temporarily unavailable. Please try again.");
  });

  return readJsonResponse(response);
}

export async function completeSiweVerification(payload, nonce, nonceSignature) {
  const response = await fetchWithTimeout("/api/complete-siwe", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload, nonce, nonceSignature }),
  }).catch(() => {
    throw new Error("Tcash could not verify your World wallet. Please try again.");
  });

  return readJsonResponse(response);
}

export async function createPaymentReference() {
  const response = await fetchWithTimeout("/api/payment-reference", {
    method: "POST",
    credentials: "include",
  }).catch(() => {
    throw new Error("Tcash could not prepare the World payment. Please try again.");
  });

  return readJsonResponse(response);
}

export async function confirmWorldPayment(payload) {
  const response = await fetchWithTimeout("/api/confirm-payment", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    throw new Error("Tcash could not confirm the World payment. Please try again.");
  });

  return readJsonResponse(response);
}

// The only client-side call that decides whether to show admin UI —
// reads the server's own verdict (api/admin-session.js), which itself
// only trusts the signed SIWE session cookie. There is nothing else to
// "log in" with: admin identity is World App identity, so this is a
// GET, not a credential submission.
export async function checkAdminSession() {
  const response = await fetchWithTimeout("/api/admin-session", {
    cache: "no-store",
    credentials: "include",
  }).catch(() => {
    throw new Error("Tcash could not verify admin access. Please try again.");
  });

  return readJsonResponse(response);
}

export async function fetchAdminOrderQueue() {
  const response = await fetchWithTimeout("/api/orders", {
    cache: "no-store",
    credentials: "include",
  }).catch(() => {
    throw new Error("Tcash could not load the shared admin order queue.");
  });

  return readJsonResponse(response);
}

export async function syncAdminOrder(order, options = {}) {
  return syncAdminOrders([order], options);
}

export async function syncAdminOrders(orders, options = {}) {
  const response = await fetchWithTimeout("/api/orders", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orders,
      notifyAdmin: false,
    }),
  }).catch(() => {
    throw new Error("Tcash could not sync orders to admin.");
  });

  return readJsonResponse(response);
}

// World ID high-value verification. Status tells the client whether the
// feature is switched on and whether this wallet already verified (so a
// returning user is never asked twice). Sign mints a fresh RP-signed
// context for IDKit; submit forwards the resulting proof for the server to
// verify with World and record. The real gate lives in api/orders.js — these
// calls only drive the pre-order UX.
// One endpoint for all three operations (GET = status, POST action=sign |
// verify) because api/ files each become their own serverless function and
// this project is at the Hobby plan's 12-function ceiling.
export async function fetchWorldIdStatus() {
  const response = await fetchWithTimeout("/api/world-id", {
    cache: "no-store",
    credentials: "include",
  }).catch(() => {
    throw new Error("Tcash could not check World ID verification status.");
  });

  return readJsonResponse(response);
}

export async function requestWorldIdSignedContext() {
  const response = await fetchWithTimeout("/api/world-id", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "sign" }),
  }).catch(() => {
    throw new Error("Tcash could not start World ID verification. Please try again.");
  });

  return readJsonResponse(response);
}

export async function submitWorldIdProof(result) {
  const response = await fetchWithTimeout("/api/world-id", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "verify", result }),
  }).catch(() => {
    throw new Error("Tcash could not submit your World ID proof. Please try again.");
  });

  return readJsonResponse(response);
}

export async function fetchSharedSettings() {
  const response = await fetchWithTimeout("/api/settings", {
    cache: "no-store",
    credentials: "include",
  }).catch(() => {
    throw new Error("Tcash could not load live operational settings.");
  });

  return readJsonResponse(response);
}

export async function pushSharedSettings(changes) {
  const response = await fetchWithTimeout("/api/settings", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(changes),
  }).catch(() => {
    throw new Error("Tcash could not save the new settings.");
  });

  return readJsonResponse(response);
}

export async function fetchSharedReferralClaims() {
  const response = await fetchWithTimeout("/api/referral-claims", {
    cache: "no-store",
    credentials: "include",
  }).catch(() => {
    throw new Error("Tcash could not load the shared referral claim queue.");
  });

  return readJsonResponse(response);
}

export async function syncReferralClaim(claim) {
  const response = await fetchWithTimeout("/api/referral-claims", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claim }),
  }).catch(() => {
    throw new Error("Tcash could not sync this referral claim.");
  });

  return readJsonResponse(response);
}
