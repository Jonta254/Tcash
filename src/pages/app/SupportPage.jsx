import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/icons/Icon";
import { getCurrentUser, haptic, openSupportEmail, openWhatsAppSupport } from "../../services";

const GUIDE_SECTIONS = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "How to begin using Tcash",
    points: [
      "Connect your World wallet first so Tcash knows who you are and can keep your account secure.",
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

/*
 * Rebuilt on the same grammar as Home/Wallet/Profile: no boxed hero, no
 * card grid — a plain greeting line, then hairline-divided sections. The
 * FAQ accordion reuses .tdr-ledger-row (the row itself is the toggle,
 * an arrow icon instead of the generic "+/−" text glyph the old version
 * used) so this screen reads as the same continuous ledger as the rest
 * of the app, not a separate "help center" component style.
 */
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

  const toggleGuide = (id) => {
    haptic("light");
    setOpenGuideId((current) => (current === id ? "" : id));
  };

  return (
    <div className="tdr-home page-enter">
      <h1 className="sr-only">Support — help and direct contact</h1>

      <div>
        <p className="tdr-home-greeting">Answers, and a direct line when you need one</p>
      </div>

      <section id="guide" className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Guide</span>
        </div>
        <div className="tdr-ledger-list">
          {GUIDE_SECTIONS.map((section) => {
            const isOpen = openGuideId === section.id;

            return (
              <div key={section.id}>
                <button
                  type="button"
                  className="tdr-ledger-row"
                  style={{ width: "100%" }}
                  onClick={() => toggleGuide(section.id)}
                  aria-expanded={isOpen}
                >
                  <div className="tdr-ledger-mid">
                    <span className="tdr-ledger-title">{section.title}</span>
                    <span className="tdr-ledger-date">{section.summary}</span>
                  </div>
                  <span className="tdr-ledger-right" aria-hidden="true">
                    <Icon name={isOpen ? "arrowUp" : "arrowDown"} size={14} strokeWidth={2.1} />
                  </span>
                </button>

                {isOpen ? (
                  <ul className="tdr-guide-points">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Direct support</span>
        </div>
        <div className="tdr-ledger-list">
          <button
            type="button"
            className="tdr-ledger-row"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() =>
              openSupportEmail({
                subject: "Tcash support request",
                body: supportEmailBody,
              })
            }
          >
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="mail" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Email support</span>
              <span className="tdr-ledger-date">Account questions, order help, privacy issues</span>
            </div>
          </button>
          <button
            type="button"
            className="tdr-ledger-row"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() =>
              openWhatsAppSupport({
                message: whatsappBody,
              })
            }
          >
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="chat" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Payment delay support</span>
              <span className="tdr-ledger-date">WhatsApp — for a payout or delivery that needs quick follow-up</span>
            </div>
          </button>
        </div>
      </section>

      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Legal and policies</span>
        </div>
        <div className="tdr-ledger-list">
          <Link to="/guidelines" className="tdr-ledger-row">
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="check" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">User Guidelines</span>
              <span className="tdr-ledger-date">Rules, responsibilities, trade limits, referral rules</span>
            </div>
          </Link>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="tdr-ledger-row">
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="check" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Terms &amp; Conditions</span>
              <span className="tdr-ledger-date">The full terms governing your use of Tcash</span>
            </div>
          </a>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="tdr-ledger-row">
            <span className="tdr-ledger-icon" aria-hidden="true"><Icon name="check" size={13} strokeWidth={1.9} /></span>
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Privacy Policy</span>
              <span className="tdr-ledger-date">What data Tcash collects and your data rights</span>
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}

export default SupportPage;
