import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  APP_CONFIG,
  calculateKesWalletBalance,
  formatCryptoAmount,
  formatKES,
  getAssetPricing,
  getCurrentUser,
  getOrdersForCurrentUser,
  getWorldWalletPortfolio,
  isUserAccessVerified,
  openSupportEmail,
  openWhatsAppSupport,
  requestWorldVerification,
  updateCurrentUserProfile,
  waitForWorldHumanVerification,
} from "../../services";

function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialUser = getCurrentUser();
  const [user, setUser] = useState(initialUser);
  const [profilePhone, setProfilePhone] = useState(initialUser?.mpesaPhoneNumber || initialUser?.phone || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [walletPortfolio, setWalletPortfolio] = useState({ assets: [] });
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const liveRates = useExchangeRates();

  const needsFirstAccessVerification =
    user?.authMethod === "world-app" && !user?.isAdmin && !isUserAccessVerified(user);

  const recentActivity = useMemo(
    () =>
      getOrdersForCurrentUser()
        .slice()
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 2),
    [user],
  );

  const assetPricing = useMemo(
    () => ({
      WLD: getAssetPricing("WLD", liveRates),
      USDC: getAssetPricing("USDC", liveRates),
    }),
    [liveRates],
  );

  const walletBoard = useMemo(() => {
    const assets = walletPortfolio.assets.map((assetEntry) => {
      const marketPriceKes = Number(liveRates[assetEntry.symbol] || 0);
      return {
        ...assetEntry,
        marketPriceKes,
      };
    });

    return {
      assets,
      totalKes: calculateKesWalletBalance(assets, liveRates),
      wld: assets.find((entry) => entry.symbol === "WLD"),
      usdc: assets.find((entry) => entry.symbol === "USDC"),
    };
  }, [liveRates, walletPortfolio.assets]);

  useEffect(() => {
    if (!user?.walletAddress) {
      setWalletPortfolio({ assets: [] });
      return;
    }

    let active = true;
    setWalletLoading(true);
    setWalletError("");

    getWorldWalletPortfolio(user.walletAddress)
      .then((portfolio) => {
        if (active) {
          setWalletPortfolio(portfolio);
        }
      })
      .catch((error) => {
        if (active) {
          setWalletError(error instanceof Error ? error.message : "Unable to load your World wallet.");
        }
      })
      .finally(() => {
        if (active) {
          setWalletLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.walletAddress, walletRefreshKey]);

  useEffect(() => {
    if (!needsFirstAccessVerification || !user?.walletAddress) {
      return;
    }

    let active = true;

    const syncVerificationState = async () => {
      const isVerified = await waitForWorldHumanVerification(user.walletAddress, {
        attempts: 2,
        intervalMs: 700,
      });

      if (active && isVerified) {
        const nextUser = updateCurrentUserProfile({
          firstAccessVerified: true,
          firstAccessVerifiedAt: new Date().toISOString(),
          firstAccessVerificationLevel: "address-book",
        });
        setUser(nextUser);
      }
    };

    syncVerificationState();

    return () => {
      active = false;
    };
  }, [needsFirstAccessVerification, user?.walletAddress]);

  const handleProfileSave = () => {
    setProfileError("");
    setProfileMessage("");

    if (!profilePhone.trim()) {
      setProfileError("Enter the M-Pesa phone number you want payouts sent to.");
      return;
    }

    const nextUser = updateCurrentUserProfile({ mpesaPhoneNumber: profilePhone.trim() });
    setUser(nextUser);
    setProfileMessage("Payout number saved.");
  };

  const handleFirstAccessVerification = async () => {
    if (!user?.walletAddress) {
      setVerificationError("TMpesa needs your World wallet session before verification can start.");
      return;
    }

    setVerificationError("");
    setVerificationLoading(true);

    try {
      const verification = await requestWorldVerification({
        action: APP_CONFIG.firstAccessVerificationAction,
        signal: `first-access:${user.walletAddress.toLowerCase()}`,
        verificationLevel: "device",
      });
      const nextUser = updateCurrentUserProfile({
        firstAccessVerified: true,
        firstAccessVerifiedAt: new Date().toISOString(),
        firstAccessVerificationLevel: verification.verificationLevel,
      });
      setUser(nextUser);

      const nextPath = location.state?.from?.pathname;
      navigate(nextPath && nextPath !== "/" ? nextPath : "/", { replace: true });
    } catch (error) {
      setVerificationError(
        error instanceof Error ? error.message : "TMpesa could not complete your first-access verification.",
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRefreshWallet = () => {
    setWalletRefreshKey((value) => value + 1);
  };

  const balanceLabel = useMemo(() => {
    if (!user?.walletAddress) {
      return "Connect wallet to view balance";
    }

    if (walletLoading) {
      return "Loading balance...";
    }

    return formatKES(walletBoard.totalKes);
  }, [user?.walletAddress, walletBoard.totalKes, walletLoading]);

  return (
    <div className="stack">
      {needsFirstAccessVerification ? (
        <section className="panel stack verification-surface">
          <div className="verification-surface-head">
            <span className="brand-kicker">First access</span>
            <span className="live-badge">Human check required</span>
          </div>
          <div>
            <h3>Unlock trading</h3>
            <p className="muted">Finish one World verification before placing buy or sell orders.</p>
          </div>
          {verificationError ? <div className="error">{verificationError}</div> : null}
          <button
            type="button"
            className="button"
            onClick={handleFirstAccessVerification}
            disabled={verificationLoading}
          >
            {verificationLoading ? "Opening World verification..." : "Complete World Verification"}
          </button>
        </section>
      ) : null}

      {!user?.isAdmin && !user?.mpesaPhoneNumber ? (
        <section className="panel stack compact-setup-panel">
          <div className="split">
            <div>
              <span className="brand-kicker">Payout setup</span>
              <h3>Save your M-Pesa number</h3>
            </div>
            <Link to="/profile" className="text-link">
              Profile
            </Link>
          </div>
          {profileError ? <div className="error">{profileError}</div> : null}
          {profileMessage ? <div className="notice">{profileMessage}</div> : null}
          <div className="field">
            <label htmlFor="profileMpesaPhone">M-Pesa payout number</label>
            <input
              id="profileMpesaPhone"
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
              placeholder="0712345678"
            />
          </div>
          <button type="button" className="button" onClick={handleProfileSave}>
            Save payout number
          </button>
        </section>
      ) : null}

      <section className="panel home-wallet-board">
        <div className="home-wallet-head">
          <div>
            <span className="brand-kicker">Settlement wallet</span>
            <h2>TMpesa</h2>
            <small>{user?.username ? `@${user.username}` : "Wallet connected"}</small>
          </div>
          <div className="home-wallet-actions">
            <span className={`status-pill ${user?.walletAddress ? "completed" : "pending"}`}>
              {user?.walletAddress ? "Connected" : "Not connected"}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={handleRefreshWallet}
              aria-label="Refresh wallet balances and prices"
              title="Refresh wallet balances and prices"
            >
              ↻
            </button>
          </div>
        </div>

        {walletError ? <div className="error">{walletError}</div> : null}

        <div className="home-balance-card">
          <div className="home-balance-main">
            <span>Balance in KES</span>
            <strong>{balanceLabel}</strong>
            {!user?.walletAddress ? <small>Connect your World wallet to start.</small> : null}
          </div>

          <div className="home-asset-rows">
            <div className="asset-row">
              <span>WLD</span>
              <strong>{walletBoard.wld ? formatCryptoAmount(walletBoard.wld.formattedBalance) : "0"}</strong>
            </div>
            <div className="asset-row">
              <span>USDC</span>
              <strong>{walletBoard.usdc ? formatCryptoAmount(walletBoard.usdc.formattedBalance) : "0"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel stack home-rates-panel">
        <div className="split compact-panel-head">
          <div>
            <span className="brand-kicker">Live rates</span>
            <h3>TMpesa desk price</h3>
          </div>
          <small className="market-panel-note">TMpesa fee included</small>
        </div>
        <div className="rates-board-compact">
          {Object.values(assetPricing).map((rateCard) => (
            <div key={rateCard.asset} className="rate-quote-card">
              <div className="rate-quote-head">
                <strong>{rateCard.asset}</strong>
                <small>Live rate</small>
              </div>
              <div className="rate-quote-values">
                <div>
                  <span>Buy</span>
                  <strong>{formatKES(rateCard.buyRateKes)}</strong>
                </div>
                <div>
                  <span>Sell</span>
                  <strong>{formatKES(rateCard.sellRateKes)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <div className="split compact-panel-head">
          <div>
            <span className="brand-kicker">Quick actions</span>
            <h3>Start quickly</h3>
          </div>
        </div>
        <div className="quick-action-grid home-quick-actions compact-home-actions">
          <Link to="/trade?tab=buy" className="quick-action-card quick-action-card-buy">
            <strong>Buy &amp; Sell</strong>
            <span>Trade WLD or USDC.</span>
          </Link>
          <Link to="/wallet#receive" className="quick-action-card quick-action-card-sell">
            <strong>Receive</strong>
            <span>Copy wallet address.</span>
          </Link>
          <Link to="/orders" className="quick-action-card quick-action-card-orders">
            <strong>History</strong>
            <span>Track your orders.</span>
          </Link>
          <Link to="/support" className="quick-action-card quick-action-card-orders">
            <strong>Support</strong>
            <span>Get help fast.</span>
          </Link>
        </div>
      </section>

      {recentActivity.length ? (
        <section className="panel stack compact-activity-panel">
          <div className="split compact-panel-head">
            <div>
              <span className="brand-kicker">Recent activity</span>
              <h3>Latest orders</h3>
            </div>
            <Link to="/orders" className="text-link">
              View history
            </Link>
          </div>
          <div className="recent-activity-list">
            {recentActivity.map((order) => (
              <div key={order.id} className="recent-activity-item">
                <div>
                  <strong>{order.type === "buy" ? "Buy" : "Sell"} {order.asset}</strong>
                  <small>{new Date(order.createdAt).toLocaleDateString()}</small>
                </div>
                <div>
                  <strong>{formatKES(order.kesAmount)}</strong>
                  <small>{order.status}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel compact-support-strip">
        <div className="compact-support-copy">
          <strong>Need help?</strong>
          <small>Payment delay or account support</small>
        </div>
        <div className="compact-support-actions">
          <button
            type="button"
            className="button-secondary"
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
            Email
          </button>
          <button
            type="button"
            className="button-ghost"
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
            Delay
          </button>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
