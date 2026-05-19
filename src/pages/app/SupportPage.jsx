import { getCurrentUser, openSupportEmail, openWhatsAppSupport } from "../../services";

function SupportPage() {
  const user = getCurrentUser();

  return (
    <div className="stack">
      <section className="panel profile-hero">
        <div className="profile-hero-head">
          <div>
            <span className="brand-kicker">Support</span>
            <h2>Support and delay follow-up</h2>
            <p className="muted">
              Use email for account questions, or open WhatsApp if a payment or payout needs fast
              attention.
            </p>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <span className="brand-kicker">Direct support</span>
        <div className="profile-links-grid">
          <button
            type="button"
            className="profile-link-card"
            onClick={() =>
              openSupportEmail({
                subject: "TMpesa support request",
                body: [
                  "Hello TMpesa support,",
                  "",
                  "I need help with my account or order.",
                  "",
                  `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
                ].join("\n"),
              })
            }
          >
            <strong>Email support</strong>
            <span>Use email for account questions, order help, privacy issues, or general support.</span>
          </button>
          <button
            type="button"
            className="profile-link-card"
            onClick={() =>
              openWhatsAppSupport({
                message: [
                  "Hello TMpesa support,",
                  "",
                  "My payment or settlement is delayed and I need assistance.",
                  "",
                  `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
                ].join("\n"),
              })
            }
          >
            <strong>Payment delay support</strong>
            <span>Open WhatsApp when a payment, payout, or crypto delivery needs quick follow-up.</span>
          </button>
        </div>
      </section>

      <section className="panel stack">
        <span className="brand-kicker">Help guide</span>
        <div className="flow-list">
          <div><span>1</span><p>Check your order status from the Orders page first.</p></div>
          <div><span>2</span><p>If the status is still pending or reviewing, open support with the order details.</p></div>
          <div><span>3</span><p>Use WhatsApp for urgent payout or payment-delay follow-up.</p></div>
          <div><span>4</span><p>Use email for account, privacy, or general support requests.</p></div>
        </div>
      </section>
    </div>
  );
}

export default SupportPage;
