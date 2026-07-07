import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser, openSupportEmail, openWhatsAppSupport } from "../../services";

const GUIDE_SECTIONS = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "How to begin using Tcash",
    points: [
      "Connect your World wallet first so Tcash can read your username and wallet session.",
      "Save your M-Pesa payout number in Profile before placing sell orders or claiming referral rewards.",
      "Use Home to view your KES balance, live WLD and USDC rates, and quick actions.",
    ],
  },
  {
    id: "buy-guide",
    title: "Buy crypto",
    summary: "Pay M-Pesa and receive WLD or USDC",
    points: [
      "Open Trade, choose Buy, and enter the KES amount you want to pay.",
      "Tcash shows the live quote with fee included before you submit the order.",
      "After M-Pesa payment is confirmed, the crypto is sent to your connected World wallet.",
    ],
  },
  {
    id: "sell-guide",
    title: "Sell crypto",
    summary: "Send WLD or USDC and receive KES",
    points: [
      "Open Trade, choose Sell, then enter the crypto amount you want to send.",
      "Tcash shows the live KES payout quote with fee included before submission.",
      "After manual review, KES is sent to the M-Pesa number saved on your Tcash profile.",
    ],
  },
  {
    id: "delay-help",
    title: "Payment delay help",
    summary: "What to do if an order is delayed",
    points: [
      "Check the History page first to confirm whether the order is pending, reviewing, or completed.",
      "Use WhatsApp support for urgent payout or payment follow-up.",
      "Use email support for account questions, privacy requests, or detailed order help.",
    ],
  },
];

function SupportPage() {
  const user = getCurrentUser();
  const [openGuideId, setOpenGuideId] = useState("getting-started");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash.replace("#", "").trim();

    if (hash === "guide") {
      setOpenGuideId("getting-started");
    }
  }, []);

  const supportEmailBody = useMemo(
    () =>
      [
        "Hello Tcash support,",
        "",
        "I need help with my account or order.",
        "",
        `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
      ].join("\n"),
    [user?.username],
  );

  const whatsappBody = useMemo(
    () =>
      [
        "Hello Tcash support,",
        "",
        "My payment or settlement is delayed and I need assistance.",
        "",
        `World username: ${user?.username ? `@${user.username}` : "Not available"}`,
      ].join("\n"),
    [user?.username],
  );

  return (
    <div className="stack page-enter">
      <section className="panel profile-hero">
        <div className="profile-hero-head">
          <div>
            <span className="brand-kicker">Support</span>
            <h2>Support and help center</h2>
            <p className="muted">Quick answers, payment delay support, and direct help.</p>
          </div>
        </div>
      </section>

      <section id="guide" className="panel stack">
        <div className="split">
          <div>
            <span className="brand-kicker">Tcash guide</span>
            <h3>Simple answers for every user</h3>
            <p className="muted">Open a topic to get the answer quickly.</p>
          </div>
          <span className="status-pill completed">Quick help</span>
        </div>

        <div className="help-guide-list">
          {GUIDE_SECTIONS.map((section) => {
            const isOpen = openGuideId === section.id;

            return (
              <div key={section.id} className={`help-guide-card${isOpen ? " active" : ""}`}>
                <button
                  type="button"
                  className="help-guide-toggle"
                  onClick={() => setOpenGuideId(isOpen ? "" : section.id)}
                  aria-expanded={isOpen}
                >
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.summary}</small>
                  </span>
                  <span className="help-guide-arrow" aria-hidden="true">
                    {isOpen ? "\u2212" : "+"}
                  </span>
                </button>

                {isOpen ? (
                  <div className="help-guide-answer">
                    <ul className="help-guide-points">
                      {section.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
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
                subject: "Tcash support request",
                body: supportEmailBody,
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
                message: whatsappBody,
              })
            }
          >
            <strong>Payment delay support</strong>
            <span>Open WhatsApp when a payment, payout, or crypto delivery needs quick follow-up.</span>
          </button>
        </div>
      </section>

      <section className="panel stack">
        <span className="brand-kicker">Legal and policies</span>
        <div className="profile-links-grid">
          <Link to="/guidelines" className="profile-link-card" style={{ textDecoration: "none" }}>
            <strong>User Guidelines</strong>
            <span>Rules, responsibilities, trade limits, referral rules, and risk disclosure.</span>
          </Link>
          <a
            href="/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="profile-link-card"
            style={{ textDecoration: "none" }}
          >
            <strong>Terms &amp; Conditions</strong>
            <span>The full terms governing your use of Tcash.</span>
          </a>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="profile-link-card"
            style={{ textDecoration: "none" }}
          >
            <strong>Privacy Policy</strong>
            <span>What data Tcash collects, how it is used, and your data rights.</span>
          </a>
        </div>
      </section>
    </div>
  );
}

export default SupportPage;
