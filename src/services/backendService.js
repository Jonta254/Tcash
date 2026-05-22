async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "TMpesa could not reach the secure server. Please try again.");
  }

  return payload;
}

export async function requestServerNonce() {
  const response = await fetch("/api/nonce", {
    credentials: "include",
  }).catch(() => {
    throw new Error("TMpesa secure login is temporarily unavailable. Please try again.");
  });

  return readJsonResponse(response);
}

export async function completeSiweVerification(payload, nonce, nonceSignature) {
  const response = await fetch("/api/complete-siwe", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload, nonce, nonceSignature }),
  }).catch(() => {
    throw new Error("TMpesa could not verify your World wallet. Please try again.");
  });

  return readJsonResponse(response);
}

export async function createPaymentReference() {
  const response = await fetch("/api/payment-reference", {
    method: "POST",
    credentials: "include",
  }).catch(() => {
    throw new Error("TMpesa could not prepare the World payment. Please try again.");
  });

  return readJsonResponse(response);
}

export async function confirmWorldPayment(payload) {
  const response = await fetch("/api/confirm-payment", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    throw new Error("TMpesa could not confirm the World payment. Please try again.");
  });

  return readJsonResponse(response);
}

export async function verifyHighValueOrder(payload, action, signal) {
  const response = await fetch("/api/verify", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload, action, signal }),
  }).catch(() => {
    throw new Error("TMpesa could not verify the human check. Please try again.");
  });

  return readJsonResponse(response);
}

export async function requestWorldIdRpContext(action) {
  const response = await fetch("/api/world-id-rp-context", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  }).catch(() => {
    throw new Error("TMpesa could not prepare World ID verification. Please try again.");
  });

  return readJsonResponse(response);
}

export async function verifyWorldIdProof(payload) {
  const response = await fetch("/api/verify", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  }).catch(() => {
    throw new Error("TMpesa could not verify the World ID proof. Please try again.");
  });

  return readJsonResponse(response);
}
