const SECTIONS = [
  {
    id: "who-can-use",
    title: "Who can use Tcash",
    items: [
      { rule: "Age 18+", detail: "You must be at least 18 years old. Tcash is not available to minors." },
      { rule: "World App account", detail: "Sign in using World Wallet Auth. Shared, borrowed, or fictitious accounts are not permitted." },
      { rule: "One account per person", detail: "Use your own wallet and M-Pesa account. Do not share your wallet approval or recovery details." },
      { rule: "Lawful use", detail: "You are responsible for ensuring your use of Tcash complies with the laws applicable to you." },
    ],
  },
  {
    id: "orders",
    title: "How orders work",
    items: [
      { rule: "Buy (M-Pesa → WLD/USDC)", detail: "Pay the exact amount using the PayBill and account number shown on your saved order. Submit the M-Pesa code. An operator checks the payment and sends crypto to your World wallet." },
      { rule: "Sell (WLD/USDC → KES)", detail: "Approve the World Pay transaction, then wait for admin review. KES is sent to your saved M-Pesa payout number after confirmation." },
      { rule: "Settlement times", detail: "Settlement is manual. Check History for progress and contact support if your payment or payout is delayed. Do not pay twice." },
      { rule: "Rates and fees", detail: "The amount and Tcash fee are saved with your order before payment. M-Pesa may charge separately. The recorded amounts stay with that order." },
    ],
  },
  {
    id: "responsibilities",
    title: "Your responsibilities",
    items: [
      { rule: "Accurate details", detail: "Provide the correct M-Pesa payout number, accurate transaction codes, and truthful order information." },
      { rule: "Only your funds", detail: "Only transact with funds and wallets you legally own." },
      { rule: "No fraud", detail: "Do not submit false payment codes, reverse payments after crypto is released, or manipulate the order process in any way." },
      { rule: "No illegal activity", detail: "Tcash must not be used for money laundering, illegal financing, sanctions evasion, or any unlawful purpose." },
    ],
  },
  {
    id: "disputes",
    title: "Disputes and refunds",
    items: [
      { rule: "Contact support promptly", detail: "Reach out immediately if a buy order is not settled after payment, a sell payout is delayed, or the amount appears incorrect." },
      { rule: "No duplicate orders", detail: "Contact support before placing a duplicate order for the same transaction." },
      { rule: "Completed orders", detail: "Once an order is marked completed and funds have been sent, reversals may not be possible." },
    ],
  },
  {
    id: "risk",
    title: "Risk disclosure",
    items: [
      { rule: "Rate changes", detail: "Crypto values can change significantly. The initial estimate can change when the server saves your order. Review the saved amounts before paying." },
      { rule: "No guarantees", detail: "Crypto assets can lose value. Tcash does not provide investment advice or promise financial returns." },
      { rule: "Manual service", detail: "All orders are processed by a human operator. Settlement is not instant or automated." },
    ],
  },
  {
    id: "limits",
    title: "Service limits",
    items: [
      { rule: "Buy limits", detail: "KES 600 minimum · KES 20,000 maximum per buy order." },
      { rule: "Sell limits", detail: "Minimum USD equivalent of $1 per sell order." },
      { rule: "Kenya only", detail: "Settlement uses M-Pesa Kenya. Use a registered Kenyan M-Pesa number." },
    ],
  },
];

/*
 * Rebuilt on the same grammar as Support/Profile: no boxed hero, hairline
 * sections. Each rule reads as a .tdr-ledger-row record (title = rule,
 * subtitle = detail) instead of the old .profile-stat-row card grid, so
 * a legal document and a transaction ledger use the same visual voice.
 */
function GuidelinesPage() {
  return (
    <div className="tdr-home page-enter">
      <h1 className="tcash-page-title">How Tcash works</h1>

      <div>
        <p className="tdr-home-greeting">Rules, responsibilities, and limits for using Tcash</p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.id} className="tdr-home-section">
          <div className="tdr-home-section-head">
            <span className="tdr-home-section-title">{section.title}</span>
          </div>
          <div className="tdr-ledger-list">
            {section.items.map((item) => (
              <div key={item.rule} className="tdr-ledger-row">
                <div className="tdr-ledger-mid">
                  <span className="tdr-ledger-title">{item.rule}</span>
                  <span className="tdr-ledger-date">{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="tdr-home-section">
        <div className="tdr-home-section-head">
          <span className="tdr-home-section-title">Legal documents</span>
        </div>
        <div className="tdr-ledger-list">
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="tdr-ledger-row">
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Terms &amp; Conditions</span>
              <span className="tdr-ledger-date">Full terms governing your use of Tcash</span>
            </div>
          </a>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="tdr-ledger-row">
            <div className="tdr-ledger-mid">
              <span className="tdr-ledger-title">Privacy Policy</span>
              <span className="tdr-ledger-date">What data we collect, why, and your rights</span>
            </div>
          </a>
        </div>
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: 14 }}>
          By continuing to use Tcash you accept these guidelines, the Terms, and the Privacy Policy.
          For questions contact{" "}
          <a href="mailto:brianokindo2022@gmail.com" style={{ color: "var(--primary)" }}>
            brianokindo2022@gmail.com
          </a>.
        </p>
      </section>
    </div>
  );
}

export default GuidelinesPage;
