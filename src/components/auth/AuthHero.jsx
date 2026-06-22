import { useAppSettings } from "../../hooks/useAppSettings";

function AuthHero() {
  const settings = useAppSettings();

  return (
    <section className="hero-card hero-card-featured stack">
      <div className="hero-topline">
        <span className="brand-kicker">Tcash</span>
        <span className="live-badge">Live rates</span>
      </div>
      <div>
        <h1 className="brand-title">Buy or sell WLD and USDC with KES settlement.</h1>
        <p className="brand-copy">
          Sell from your World wallet to receive KES on M-Pesa, or deposit KES by M-Pesa so the
          admin can deliver WLD or USDC to your World account. Every order is manually reviewed
          before completion.
        </p>
      </div>

      <div className="rate-board">
        <div className="rate-card primary-rate">
          <span>WLD rate</span>
          <strong>KES {settings.ratesKes.WLD.toLocaleString()}</strong>
          <small>per 1 WLD</small>
        </div>
        <div className="rate-card">
          <span>USDC rate</span>
          <strong>KES {settings.ratesKes.USDC.toLocaleString()}</strong>
          <small>per 1 USDC</small>
        </div>
      </div>

      <div className="fee-note">
        <div>
          <strong>Displayed rates exclude fees</strong>
          <p>
            Like a P2P exchange, the shown rate is the base rate only. M-Pesa charges, network
            fees, and amount-based adjustments are confirmed before final settlement.
          </p>
        </div>
        <span>Fee excluded</span>
      </div>

      <div className="trust-grid">
        <div>
          <span>Settlement</span>
          <strong>M-Pesa</strong>
        </div>
        <div>
          <span>Wallet</span>
          <strong>World App</strong>
        </div>
        <div>
          <span>Support</span>
          <strong className="star-rating" aria-label="5 star support">
            <span className="star-shape" aria-hidden="true" />
            <span className="star-shape" aria-hidden="true" />
            <span className="star-shape" aria-hidden="true" />
            <span className="star-shape" aria-hidden="true" />
            <span className="star-shape" aria-hidden="true" />
          </strong>
        </div>
      </div>
    </section>
  );
}

export default AuthHero;
