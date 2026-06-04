import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useExchangeRates } from "../../hooks/useExchangeRate";
import {
  getCachedWorldWalletPortfolio,
  calculateKesWalletBalance,
  fetchWorldMarketRates,
  formatCryptoAmount,
  formatKES,
  getCurrentUser,
  getOrdersForCurrentUser,
  getReferralSummary,
  getWorldWalletPortfolio,
  haptic,
  markReferralShared,
  openSupportEmail,
  openWhatsAppSupport,
  shareMiniAppInvite,
  updateCurrentUserProfile,
} from "../../services";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function statusLabel(status) {
  if (status === "paid") return "Reviewing";
  if (status === "completed") return "Completed";
  if (status === "rejected" || status === "cancelled") return "Failed";
  return "Pending";
}

function DashboardPage() {
  const initialUser = getCurrentUser();
  const initialPortfolio = getCachedWorldWalletPortfolio(initialUser?.walletAddress);
  const [user, setUser] = useState(initialUser);
  const [profilePhone, setProfilePhone] = useState(
    initialUser?.mpesaPhoneNumber || initialUser?.phone || "",
  );
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
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

  const recentActivity = useMemo(
    () =>
      getOrdersForCurrentUser()
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );

  const homeMarketRates = useMemo(
    () => [
      { asset: "WLD", priceKes: Number(liveRates?.WLD) || 0 },
      { asset: "USDC", priceKes: Number(liveRates?.USDC) || 0 },
    ],
    [liveRates],
  );

  const hasLiveMarketRates = homeMarketRates.every((r) => r.priceKes > 1);

  const walletBoard = useMemo(() => {
    const assets = walletPortfolio.assets.map((a) => ({
      ...a,
      marketPriceKes: Number(liveRates[a.symbol] || 0),
    }));
    return {
      assets,
      totalKes: calculateKesWalletBalance(assets, liveRates),
      wld: assets.find((a) => a.symbol === "WLD"),
      usdc: assets.find((a) => a.symbol === "USDC"),
    };
  }, [liveRates, walletPortfolio.assets]);

  const hasWalletBalances = useMemo(
    () => walletPortfolio.assets.some((a) => Number(a.formattedBalance || 0) > 0),
    [walletPortfolio.assets],
  );

  const loadWalletPortfolio = useCallback(
    async ({ showErrors = false } = {}) => {
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
        const cached = getCachedWorldWalletPortfolio(user.walletAddress);
        if (cached.assets.length) {
          setWalletPortfolio(cached);
        } else {
          setWalletPortfolio({ walletAddress: user.walletAddress, assets: [], supported: true });
          if (showErrors) {
            setWalletError(
              error instanceof Error ? error.message : "Unable to refresh wallet.",
            );
          }
        }
      } finally {
        setWalletLoading(false);
      }
    },
    [user?.walletAddress],
  );

  useEffect(() => {
    loadWalletPortfolio().catch(() => null);
  }, [loadWalletPortfolio]);

  const normalizeKenyanPhone = (raw) => {
    const c = raw.replace(/\s+/g, "").replace(/-/g, "");
    if (/^\+254[17]\d{8}$/.test(c)) return c.slice(1);
    if (/^254[17]\d{8}$/.test(c)) return `0${c.slice(3)}`;
    if (/^0[17]\d{8}$/.test(c)) return c;
    return null;
  };

  const handleProfileSave = () => {
    setProfileError("");
    setProfileMessage("");
    if (!profilePhone.trim()) {
      setProfileError("Enter your M-Pesa number for sell payouts.");
      return;
    }
    const normalized = normalizeKenyanPhone(profilePhone.trim());
    if (!normalized) {
      setProfileError("Enter a valid Kenyan number — e.g. 0712345678.");
      return;
    }
    setProfilePhone(normalized);
    const next = updateCurrentUserProfile({ mpesaPhoneNumber: normalized });
    setUser(next);
    haptic("success");
    setProfileMessage("Saved.");
  };

  const handleRefreshWallet = async () => {
    setWalletError("");
    setWalletRefreshing(true);
    haptic("light");
    try {
      await loadWalletPortfolio({ showErrors: true });
    } finally {
      setWalletRefreshing(false);
    }
  };

  const handleRefreshRates = async () => {
    setMarketRefreshError("");
    setMarketRefreshing(true);
    haptic("light");
    try {
      await fetchWorldMarketRates();
    } catch (error) {
      if (!hasLiveMarketRates) {
        setMarketRefreshError(
          error instanceof Error ? error.message : "Unable to refresh prices.",
        );
      }
    } finally {
      setMarketRefreshing(false);
    }
  };

  const handleShareInvite = async () => {
    setReferralError("");
    setReferralMessage("");
    haptic("medium");
    try {
      await shareMiniAppInvite({
        title: "Join TMpesa",
        text: `Use my TMpesa invite code ${referralSummary.code} to trade WLD and USDC with M-Pesa settlement inside World App.`,
        url: referralSummary.appLink,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMessage("Invite shared.");
    } catch (error) {
      setReferralError(error instanceof Error ? error.message : "Unable to share invite.");
    }
  };

  const balanceLabel = useMemo(() => {
    if (!user?.walletAddress) return "KES —";
    if (!hasLiveMarketRates && !hasWalletBalances) return "KES —";
    return formatKES(walletBoard.totalKes);
  }, [hasLiveMarketRates, hasWalletBalances, user?.walletAddress, walletBoard.totalKes]);

  const balanceSublabel = useMemo(() => {
    if (!user?.walletAddress) return "Connect wallet to see your balance";
    if (walletRefreshing || (walletLoading && !hasWalletBalances)) return "Syncing wallet…";
    if (walletError && !hasWalletBalances) return "Sync failed — tap ↻ to retry";
    return "Total portfolio value in KES";
  }, [hasWalletBalances, user?.walletAddress, walletError, walletLoading, walletRefreshing]);

  const assetVal = useCallback(
    (entry) => {
      if (entry) return formatCryptoAmount(entry.formattedBalance);
      if (!user?.walletAddress || walletLoading) return "—";
      return "0";
    },
    [user?.walletAddress, walletLoading],
  );

  const greeting = getGreeting();
  const displayName = user?.username ? `@${user.username}` : user?.fullName || null;
  const hasWorldSession = Boolean(user?.username);

  return (
    <div className="stack page-enter">

      {/* ── 1. GREETING ─────────────────────────────────────── */}
      <section className="home-greeting">
        <div className="home-greeting-inner">
          <div className="home-greeting-text">
            <p className="home-greeting-salutation">{greeting}{displayName ? "," : "."}</p>
            {displayName ? (
              <h2 className="home-greeting-name">{displayName}</h2>
            ) : (
              <h2 className="home-greeting-name">Welcome to TMpesa</h2>
            )}
          </div>
          {hasWorldSession ? (
            <span className="home-greeting-badge">
              <span className="home-greeting-dot" aria-hidden="true" />
              World verified
            </span>
          ) : null}
        </div>
        <p className="home-greeting-sub muted">
          Buy or sell WLD · USDC with M-Pesa settlement.
        </p>
      </section>

      {/* ── 2. PAYOUT SETUP (only if needed) ───────────────── */}
      {!user?.isAdmin && !user?.mpesaPhoneNumber ? (
        <section className="panel stack home-setup-nudge">
          <div className="home-setup-nudge-head">
            <span className="home-setup-nudge-icon" aria-hidden="true">📲</span>
            <div>
              <strong>Finish setup</strong>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.9rem" }}>
                Add your M-Pesa number to enable sell payouts and referral rewards.
              </p>
            </div>
          </div>
          {profileError ? <div className="error">{profileError}</div> : null}
          {profileMessage ? <div className="notice">{profileMessage}</div> : null}
          <div className="home-setup-row">
            <div className="field" style={{ flex: 1 }}>
              <input
                id="profileMpesaPhone"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="e.g. 0712345678"
                inputMode="tel"
                aria-label="M-Pesa payout number"
              />
            </div>
            <button type="button" className="button home-setup-btn" onClick={handleProfileSave}>
              Save
            </button>
          </div>
        </section>
      ) : null}

      {/* ── 3. PORTFOLIO BALANCE ────────────────────────────── */}
      <section className="panel home-wallet-board">
        <div className="home-wallet-head">
          <span className="brand-kicker">Portfolio</span>
          <Link to="/wallet" className="text-link home-wallet-link">
            Wallet →
          </Link>
        </div>

        <div className="home-balance-card">
          <div className="home-balance-meta">
            <span className={`live-badge live-badge-small${user?.walletAddress ? "" : " muted-badge"}`}>
              {user?.walletAddress ? "Wallet connected" : "No wallet"}
            </span>
            <button
              type="button"
              className="icon-button icon-button-compact"
              onClick={handleRefreshWallet}
              aria-label="Refresh wallet"
            >
              {walletRefreshing ? <span className="spin">↻</span> : "↻"}
            </button>
          </div>

          <div className="home-balance-hero-block">
            <span className="home-balance-label">Total balance</span>
            <strong className="home-balance-number">{balanceLabel}</strong>
            <small className="home-balance-sub">{balanceSublabel}</small>
          </div>

          <div className="home-asset-rows">
            <div className="asset-row">
              <div className="asset-row-left">
                <span className="asset-symbol-badge asset-symbol-wld">W</span>
                <span className="asset-row-name">WLD</span>
              </div>
              <strong>{assetVal(walletBoard.wld)}</strong>
            </div>
            <div className="asset-row">
              <div className="asset-row-left">
                <span className="asset-symbol-badge asset-symbol-usdc">$</span>
                <span className="asset-row-name">USDC</span>
              </div>
              <strong>{assetVal(walletBoard.usdc)}</strong>
            </div>
          </div>

          {walletError && !hasWalletBalances ? (
            <div className="home-balance-error">{walletError}</div>
          ) : null}
        </div>
      </section>

      {/* ── 4. QUICK ACTIONS ────────────────────────────────── */}
      <section className="panel stack home-actions-panel">
        <span className="brand-kicker">Actions</span>
        <div className="home-actions-grid">
          <Link to="/trade?tab=buy" className="home-action-card home-action-buy">
            <span className="home-action-icon" aria-hidden="true">↑</span>
            <strong>Buy</strong>
            <span>Pay KES · get crypto</span>
          </Link>
          <Link to="/trade?tab=sell" className="home-action-card home-action-sell">
            <span className="home-action-icon" aria-hidden="true">↓</span>
            <strong>Sell</strong>
            <span>Send crypto · get KES</span>
          </Link>
          <Link to="/wallet#receive" className="home-action-card home-action-receive">
            <span className="home-action-icon" aria-hidden="true">⬡</span>
            <strong>Receive</strong>
            <span>Copy address</span>
          </Link>
          <Link to="/orders" className="home-action-card home-action-history">
            <span className="home-action-icon" aria-hidden="true">≡</span>
            <strong>History</strong>
            <span>Track orders</span>
          </Link>
        </div>
      </section>

      {/* ── 5. LIVE PRICES ──────────────────────────────────── */}
      <section className="panel stack home-rates-panel">
        <div className="split compact-panel-head">
          <div>
            <span className="brand-kicker">Market</span>
            <h3>Live prices</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {marketRefreshError ? null : (
              <small className="market-panel-note">
                {marketRefreshing ? "Syncing…" : hasLiveMarketRates ? "Live" : "Syncing…"}
              </small>
            )}
            <button
              type="button"
              className="icon-button icon-button-compact"
              onClick={handleRefreshRates}
              aria-label="Refresh prices"
            >
              {marketRefreshing ? <span className="spin">↻</span> : "↻"}
            </button>
          </div>
        </div>

        {marketRefreshError ? (
          <div className="error" style={{ fontSize: "0.86rem", padding: "10px 12px" }}>
            {marketRefreshError}
          </div>
        ) : null}

        <div className="rates-board-compact">
          {homeMarketRates.map((r) => (
            <div key={r.asset} className="rate-quote-card rate-quote-card-compact">
              <div className="rate-quote-head">
                <strong>{r.asset}</strong>
                <span className={`rate-live-dot${r.priceKes > 1 ? " live" : ""}`} aria-hidden="true" />
              </div>
              <div className="rate-quote-market">
                <strong>
                  {r.priceKes > 1 ? formatKES(r.priceKes) : "KES —"}
                </strong>
                <span>{r.priceKes > 1 ? `per 1 ${r.asset}` : "Loading…"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. RECENT ORDERS ────────────────────────────────── */}
      {recentActivity.length ? (
        <section className="panel stack compact-activity-panel">
          <div className="split compact-panel-head">
            <div>
              <span className="brand-kicker">Activity</span>
              <h3>Recent orders</h3>
            </div>
            <Link to="/orders" className="text-link" style={{ fontSize: "0.88rem" }}>
              See all →
            </Link>
          </div>
          <div className="recent-activity-list">
            {recentActivity.map((order) => (
              <Link
                key={order.id}
                to="/orders"
                className="recent-activity-item recent-activity-link"
              >
                <div className="recent-activity-left">
                  <span className={`activity-type-badge activity-type-${order.type}`}>
                    {order.type === "buy" ? "Buy" : "Sell"}
                  </span>
                  <strong>
                    {order.cryptoAmount ? `${formatCryptoAmount(order.cryptoAmount)} ` : ""}
                    {order.asset}
                  </strong>
                  <small>{new Date(order.createdAt).toLocaleDateString()}</small>
                </div>
                <div className="recent-activity-right">
                  <strong>{formatKES(order.kesAmount)}</strong>
                  <small>
                    <span className={`activity-status-dot ${order.status}`} />
                    {statusLabel(order.status)}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── 7. REFERRAL ─────────────────────────────────────── */}
      <section className="panel home-referral-strip">
        <div className="home-referral-left">
          <span className="home-referral-icon" aria-hidden="true">🎁</span>
          <div>
            <strong>Invite &amp; earn</strong>
            <p className="muted">
              Share your code <span className="home-referral-code">{referralSummary.code}</span> and
              earn rewards when friends trade.
            </p>
          </div>
        </div>
        <div className="home-referral-actions">
          {referralMessage ? (
            <small className="home-referral-msg">{referralMessage}</small>
          ) : referralError ? (
            <small className="home-referral-err">{referralError}</small>
          ) : null}
          <button type="button" className="button home-referral-btn" onClick={handleShareInvite}>
            Share
          </button>
        </div>
      </section>

      {/* ── 8. HELP STRIP ───────────────────────────────────── */}
      <section className="panel home-help-strip">
        <span className="home-help-label">Need help?</span>
        <div className="home-help-actions">
          <Link to="/support" className="button-ghost home-help-btn">
            Guide
          </Link>
          <button
            type="button"
            className="button-secondary home-help-btn"
            onClick={() =>
              openSupportEmail({
                subject: "TMpesa support request",
                body: `Hello TMpesa support,\n\nWorld username: ${user?.username ? `@${user.username}` : "N/A"}`,
              })
            }
          >
            Email
          </button>
          <button
            type="button"
            className="button-ghost home-help-btn"
            onClick={() =>
              openWhatsAppSupport({
                message: `Hello TMpesa,\n\nI need help with a delayed order.\n\nWorld username: ${user?.username ? `@${user.username}` : "N/A"}`,
              })
            }
          >
            WhatsApp
          </button>
        </div>
      </section>

    </div>
  );
}

export default DashboardPage;
