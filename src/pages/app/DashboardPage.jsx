import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  APP_CONFIG,
  getCachedWorldWalletPortfolio,
  calculateKesWalletBalance,
  fetchWorldMarketRates,
  formatCryptoAmount,
  formatKES,
  getCurrentUser,
  getOrdersForCurrentUser,
  getReferralSummary,
  getWorldWalletPortfolio,
  isUserAccessVerified,
  markReferralShared,
  openSupportEmail,
  openWhatsAppSupport,
  requestWorldVerification,
  shareMiniAppInvite,
  updateCurrentUserProfile,
  waitForWorldHumanVerification,
} from "../../services";

function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialUser = getCurrentUser();
  const initialPortfolio = getCachedWorldWalletPortfolio(initialUser?.walletAddress);
  const [user, setUser] = useState(initialUser);
  const [profilePhone, setProfilePhone] = useState(
    initialUser?.mpesaPhoneNumber || initialUser?.phone || "",
  );
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [walletPortfolio, setWalletPortfolio] = useState(() => initialPortfolio);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [marketRefreshError, setMarketRefreshError] = useState("");
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [referralSummary, setReferralSummary] = useState(() => getReferralSummary(initialUser));
  const [referralMessage, setReferralMessage] = useState("");
  const [referralError, setReferralError] = useState("");
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

  const homeMarketRates = useMemo(
    () => [
      {
        asset: "WLD",
        priceKes: Number(liveRates?.WLD) || 0,
      },
      {
        asset: "USDC",
        priceKes: Number(liveRates?.USDC) || 0,
      },
    ],
    [liveRates],
  );

  const hasLiveMarketRates = homeMarketRates.every((entry) => entry.priceKes > 1);

  const walletBoard = useMemo(() => {
    const assets = walletPortfolio.assets.map((assetEntry) => ({
      ...assetEntry,
      marketPriceKes: Number(liveRates[assetEntry.symbol] || 0),
    }));

    return {
      assets,
      totalKes: calculateKesWalletBalance(assets, liveRates),
      wld: assets.find((entry) => entry.symbol === "WLD"),
      usdc: assets.find((entry) => entry.symbol === "USDC"),
    };
  }, [liveRates, walletPortfolio.assets]);

  const hasWalletBalances = useMemo(
    () =>
      walletPortfolio.assets.some((assetEntry) => Number(assetEntry.formattedBalance || 0) > 0),
    [walletPortfolio.assets],
  );

  const loadWalletPortfolio = useCallback(async ({ showErrors = false } = {}) => {
    if (!user?.walletAddress) {
      setWalletPortfolio({ walletAddress: "", assets: [], supported: false });
      setWalletError("");
      setWalletLoading(false);
      return;
    }

    setWalletLoading(true);
    setWalletError("");

    try {
      const portfolio = await getWorldWalletPortfolio(user.walletAddress);
      setWalletPortfolio(portfolio);
    } catch (error) {
      const cachedPortfolio = getCachedWorldWalletPortfolio(user.walletAddress);

      if (cachedPortfolio.assets.length) {
        setWalletPortfolio(cachedPortfolio);
        setWalletError("");
      } else {
        setWalletPortfolio({
          walletAddress: user.walletAddress,
          assets: [],
          supported: true,
        });
        setWalletError(
          showErrors
            ? error instanceof Error
              ? error.message
              : "Unable to refresh your World wallet right now."
            : "",
        );
      }
    } finally {
      setWalletLoading(false);
    }
  }, [user?.walletAddress]);

  useEffect(() => {
    loadWalletPortfolio().catch(() => null);
  }, [loadWalletPortfolio]);

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
        error instanceof Error
          ? error.message
          : "TMpesa could not complete your first-access verification.",
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRefreshWalletBalances = async () => {
    setWalletError("");
    setWalletRefreshing(true);
    try {
      await loadWalletPortfolio({ showErrors: true });
    } finally {
      setWalletRefreshing(false);
    }
  };

  const handleRefreshMarketRates = async () => {
    setMarketRefreshError("");
    setMarketRefreshing(true);
    try {
      const result = await fetchWorldMarketRates();

      if (!result?.isFallback) {
        setMarketRefreshError("");
      }
    } catch (error) {
      if (!hasLiveMarketRates) {
        setMarketRefreshError(
          error instanceof Error ? error.message : "Unable to refresh live market prices.",
        );
      }
    } finally {
      setMarketRefreshing(false);
    }
  };

  const handleShareInvite = async () => {
    setReferralError("");
    setReferralMessage("");

    try {
      await shareMiniAppInvite({
        title: "Join TMpesa",
        text: `Use my TMpesa invite code ${referralSummary.code} to join the World mini app and trade WLD or USDC with M-Pesa settlement.`,
        url: referralSummary.appLink,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMessage("Invite ready to share.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to open the invite link.");
    }
  };

  const balanceLabel = useMemo(() => {
    if (!user?.walletAddress) {
      return "KES --";
    }

    if (!hasLiveMarketRates && !hasWalletBalances) {
      return "KES --";
    }

    return formatKES(walletBoard.totalKes);
  }, [hasLiveMarketRates, hasWalletBalances, user?.walletAddress, walletBoard.totalKes]);

  const portfolioSyncLabel = useMemo(() => {
    if (!user?.walletAddress) {
      return "Connect wallet to view your portfolio.";
    }

    if (walletRefreshing) {
      return "Syncing wallet...";
    }

    if (walletLoading && !hasWalletBalances) {
      return "Syncing wallet...";
    }

    if (walletError && !hasWalletBalances) {
      return "Unable to sync. Tap refresh.";
    }

    return "Live wallet balance";
  }, [hasWalletBalances, user?.walletAddress, walletError, walletLoading, walletRefreshing]);

  const marketSyncLabel = useMemo(() => {
    if (marketRefreshing) {
      return "Syncing market...";
    }

    if (!hasLiveMarketRates) {
      return marketRefreshError ? "Unable to sync. Tap refresh." : "Syncing market...";
    }

    return "Market prices update live";
  }, [hasLiveMarketRates, marketRefreshError, marketRefreshing]);

  const getAssetDisplayValue = useCallback(
    (assetEntry) => {
      if (assetEntry) {
        return formatCryptoAmount(assetEntry.formattedBalance);
      }

      if (!user?.walletAddress || walletLoading) {
        return "--";
      }

      return "0";
    },
    [user?.walletAddress, walletLoading],
  );

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
            <span className="brand-kicker">Portfolio</span>
          </div>
        </div>

        <div className="home-balance-card">
          <div className="home-balance-meta">
            <span className={`live-badge live-badge-small${user?.walletAddress ? "" : " muted-badge"}`}>
              {user?.walletAddress ? "Wallet connected" : "Wallet not connected"}
            </span>
            <button
              type="button"
              className="icon-button icon-button-compact"
              onClick={handleRefreshWalletBalances}
              aria-label="Refresh wallet balance"
              title="Refresh wallet balance"
            >
              {walletRefreshing ? "..." : "\u21BB"}
            </button>
          </div>

          <div className="home-balance-main home-balance-main-compact">
            <div className="home-balance-meta">
              <span>Balance in KES</span>
            </div>
            <strong>{balanceLabel}</strong>
            <small>{portfolioSyncLabel}</small>
          </div>

          <div className="home-asset-rows">
            <div className="asset-row">
              <span>WLD</span>
              <strong>{getAssetDisplayValue(walletBoard.wld)}</strong>
            </div>
            <div className="asset-row">
              <span>USDC</span>
              <strong>{getAssetDisplayValue(walletBoard.usdc)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel stack home-rates-panel">
        <div className="split compact-panel-head">
          <div>
            <span className="brand-kicker">Live prices</span>
            <h3>Market</h3>
          </div>
          <div className="home-wallet-actions home-wallet-actions-compact">
            <small className="market-panel-note">{marketSyncLabel}</small>
            <button
              type="button"
              className="icon-button icon-button-compact"
              onClick={handleRefreshMarketRates}
              aria-label="Refresh live prices"
              title="Refresh live prices"
            >
              {marketRefreshing ? "..." : "\u21BB"}
            </button>
          </div>
        </div>
        {marketRefreshError && !hasLiveMarketRates ? (
          <div className="error">Unable to sync. Tap refresh.</div>
        ) : null}
        <div className="rates-board-compact">
          {homeMarketRates.map((rateCard) => (
            <div key={rateCard.asset} className="rate-quote-card rate-quote-card-compact">
              <div className="rate-quote-head">
                <strong>{rateCard.asset}</strong>
                <small>KES market</small>
              </div>
              <div className="rate-quote-market">
                <strong>{rateCard.priceKes > 1 ? formatKES(rateCard.priceKes) : "KES --"}</strong>
                <span>{rateCard.priceKes > 1 ? `per 1 ${rateCard.asset}` : "Syncing market..."}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <div className="split compact-panel-head">
          <div>
            <span className="brand-kicker">Actions</span>
            <h3>Quick actions</h3>
          </div>
        </div>
        <div className="quick-action-grid home-quick-actions compact-home-actions">
          <Link to="/trade?tab=buy" className="quick-action-card quick-action-card-buy">
            <strong>Buy &amp; Sell</strong>
            <span>Trade now.</span>
          </Link>
          <Link to="/wallet#receive" className="quick-action-card quick-action-card-sell">
            <strong>Receive</strong>
            <span>Copy address.</span>
          </Link>
          <Link to="/orders" className="quick-action-card quick-action-card-orders">
            <strong>History</strong>
            <span>Track orders.</span>
          </Link>
          <Link to="/support" className="quick-action-card quick-action-card-orders">
            <strong>Support</strong>
            <span>Get help.</span>
          </Link>
        </div>
      </section>

      <section className="panel stack home-referral-panel">
        <div className="split compact-panel-head">
          <div>
            <span className="brand-kicker">Referral</span>
            <h3>Invite</h3>
          </div>
          <span className="status-pill paid">Code {referralSummary.code}</span>
        </div>
        <p className="muted compact-referral-copy">
          Share TMpesa and unlock referral rewards.
        </p>
        {referralMessage ? <div className="notice">{referralMessage}</div> : null}
        {referralError ? <div className="error">{referralError}</div> : null}
        <div className="referral-milestone-grid">
          {referralSummary.rewardMilestones.map((milestone) => (
            <div key={milestone.users} className="referral-mini-card">
              <span>{milestone.users} users</span>
              <strong>{formatKES(milestone.rewardKes)}</strong>
            </div>
          ))}
        </div>
        <div className="button-row compact-actions">
          <button type="button" className="button" onClick={handleShareInvite}>
            Share invite
          </button>
          <Link to="/profile" className="button-secondary">
            Referral center
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
                  <strong>
                    {order.type === "buy" ? "Buy" : "Sell"} {order.asset}
                  </strong>
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
          <strong>Help</strong>
          <small>Guide, email, or payout follow-up</small>
        </div>
        <div className="compact-support-actions">
          <Link to="/support#guide" className="button-ghost">
            Guide
          </Link>
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
