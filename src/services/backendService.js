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
    throw new Error(payload?.error || payload?.message || "Tcash could not reach the secure server. Please try again.");
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
