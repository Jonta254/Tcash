const SECTIONS = [
  {
    id: "who-can-use",
    title: "Who can use Tcash",
    items: [
      { rule: "Age 18+", detail: "You must be at least 18 years old. Tcash is not available to minors." },
      { rule: "World App account", detail: "Sign in using World Wallet Auth. Shared, borrowed, or fictitious accounts are not permitted." },
      { rule: "One account per person", detail: "Operating multiple accounts to exploit the referral program or any Tcash feature is prohibited." },
      { rule: "Lawful use", detail: "You are responsible for ensuring your use of Tcash complies with the laws applicable to you." },
    ],
  },
  {
    id: "orders",
    title: "How orders work",
    items: [
      { rule: "Buy (M-Pesa → WLD/USDC)", detail: "Pay the quoted KES amount to the Tcash M-Pesa PayBill with your order reference, then submit your transaction code. Admin verifies and releases crypto to your World wallet." },
      { rule: "Sell (WLD/USDC → KES)", detail: "Approve the World Pay transaction, then wait for admin review. KES is sent to your saved M-Pesa payout number after confirmation." },
      { rule: "Settlement times", detail: "Orders are manually reviewed. Typical settlement is within a few hours during business hours. Contact support if not settled within 24 hours." },
      { rule: "Rates and fees", detail: "Live rates plus a per-coin fee are shown in the quote before you confirm. The rate active when the admin processes your order applies to settlement." },
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
    id: "referral",
    title: "Referral program rules",
    items: [
      { rule: "Genuine referrals only", detail: "Referral rewards are for inviting real new World users who trade on Tcash. Self-referrals and fake accounts are prohibited and will result in suspension." },
      { rule: "Reward eligibility", detail: "Base reward (KES 30) credited when a referred user completes their first trade. Milestones: KES 100 at 6 activated referrals, KES 150 at 10." },
      { rule: "Claim process", detail: "Claims are reviewed manually and paid to your saved M-Pesa number. Tcash may withhold rewards that appear fraudulent." },
    ],
  },
  {
    id: "disputes",
    title: "Disputes and refunds",
    items: [
      { rule: "Contact support promptly", detail: "Reach out immediately if a buy order is not settled after payment, a sell payout has not arrived within 24 hours, or the amount appears incorrect." },
      { rule: "No duplicate orders", detail: "Contact support before placing a duplicate order for the same transaction." },
      { rule: "Completed orders", detail: "Once an order is marked completed and funds have been sent, reversals may not be possible." },
    ],
  },
  {
    id: "risk",
    title: "Risk disclosure",
    items: [
      { rule: "Rate changes", detail: "Crypto values can change significantly. The settled rate is the one active when your order is processed, which may differ from the quote at submission." },
      { rule: "No guarantees", detail: "Tcash does not guarantee any particular exchange rate or payout amount. Only trade amounts you can afford to lose." },
      { rule: "Manual service", detail: "All orders are processed by a human operator. Settlement is not instant or automated." },
    ],
  },
  {
    id: "limits",
    title: "Service limits",
    items: [
      { rule: "Buy limits", detail: "KES 600 minimum · KES 20,000 maximum per buy order." },
      { rule: "Sell limits", detail: "Minimum USD equivalent of $1 per sell order." },
      { rule: "Kenya only", detail: "Mobile-money settlement is via M-Pesa Kenya and Airtel Kenya. International settlement is not currently supported." },
    ],
  },
];

function GuidelinesPage() {
  return (
    <div className="stack page-enter">
      <section className="panel profile-hero">
        <div className="profile-hero-head">
          <div>
            <span className="brand-kicker">Legal</span>
            <h2>User Guidelines</h2>
            <p className="muted">
              Rules, responsibilities, and limits for using Tcash.
            </p>
          </div>
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.id} className="panel stack">
          <span className="brand-kicker">{section.title}</span>
          <div className="profile-stats-list">
            {section.items.map((item) => (
              <div key={item.rule} className="profile-stat-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <strong style={{ fontSize: "0.9rem" }}>{item.rule}</strong>
                <span className="muted" style={{ fontSize: "0.85rem" }}>{item.detail}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="panel stack">
        <span className="brand-kicker">Legal documents</span>
        <div className="profile-links-grid">
          <a
            href="/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="profile-link-card"
            style={{ textDecoration: "none" }}
          >
            <strong>Terms &amp; Conditions</strong>
            <span>Full terms governing your use of Tcash.</span>
          </a>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="profile-link-card"
            style={{ textDecoration: "none" }}
          >
            <strong>Privacy Policy</strong>
            <span>What data we collect, why, and your rights.</span>
          </a>
        </div>
        <div className="soft-note">
          By continuing to use Tcash you accept these guidelines, the Terms, and the Privacy Policy. For questions contact <a href="mailto:brianokindo2022@gmail.com" style={{ color: "var(--primary)" }}>brianokindo2022@gmail.com</a>.
        </div>
      </section>
    </div>
  );
}

export default GuidelinesPage;
