import { getSettings } from "./settingsService";

function encodeQueryValue(value) {
  return encodeURIComponent(value).replace(/%20/g, "%20");
}

function buildGmailComposeUrl({ subject, body }) {
  const supportEmail = getSettings().supportEmail;
  return (
    "https://mail.google.com/mail/?" +
    `view=cm&fs=1&to=${encodeQueryValue(supportEmail)}&su=${encodeQueryValue(subject)}&body=${encodeQueryValue(body)}`
  );
}

function buildMailToUrl({ subject, body }) {
  const supportEmail = getSettings().supportEmail;
  return `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeQueryValue(subject)}&body=${encodeQueryValue(body)}`;
}

export function openSupportEmail({ subject, body }) {
  const mailToUrl = buildMailToUrl({ subject, body });
  const gmailUrl = buildGmailComposeUrl({ subject, body });

  const link = document.createElement("a");
  link.href = mailToUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    window.location.href = gmailUrl;
  }, 700);
}

export function openWhatsAppSupport({ message }) {
  const settings = getSettings();
  const baseUrl = settings.whatsappSupportLink || "";

  if (!baseUrl) {
    return;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("text", message);
    window.location.href = url.toString();
  } catch {
    window.location.href = baseUrl;
  }
}

export function openOrderSupportEmail(order, mode = "support") {
  const subject =
    mode === "delay"
      ? `TMpesa payment delay help - Order ${order.id}`
      : `TMpesa support request - Order ${order.id}`;

  const body = [
    `Hello TMpesa team,`,
    "",
    mode === "delay"
      ? "My payment or settlement appears delayed and I need assistance."
      : "I need help with my account or order.",
    "",
    `Order ID: ${order.id}`,
    `Order Type: ${order.type}`,
    `Asset: ${order.asset}`,
    `Crypto Amount: ${order.cryptoAmount}`,
    `KES Amount: ${order.kesAmount}`,
    `Status: ${order.status}`,
    order.paymentReference ? `Reference: ${order.paymentReference}` : null,
    "",
    "Please assist me.",
  ]
    .filter(Boolean)
    .join("\n");

  if (mode === "delay") {
    openWhatsAppSupport({
      message: [
        "Hello TMpesa team,",
        "",
        "My payment or settlement seems delayed. Please review my order and assist me.",
        "",
        `Order ID: ${order.id}`,
        `Order Type: ${order.type}`,
        `Asset: ${order.asset}`,
        `Crypto Amount: ${order.cryptoAmount}`,
        `KES Amount: ${order.kesAmount}`,
        `Status: ${order.status}`,
        order.paymentReference ? `Reference: ${order.paymentReference}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    return;
  }

  openSupportEmail({ subject, body });
}
