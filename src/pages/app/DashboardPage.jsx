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
  const avatarLetter = user?.username
    ? user.username[0].toUpperCase()
    : user?.fullName
    ? user.fullName[0].toUpperCase()
    : "T";

  return (
    <div className="dash-root page-enter">

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — APP BAR  (always visible, ~52 px)
          ══════════════════════════════════════════════════ */}
      <header className="dash-appbar">
        <div className="dash-appbar-brand">
          <span className="dash-appbar-logo" aria-hidden="true">M</span>
          <span className="dash-appbar-name">TMpesa</span>
        </div>
        <div className="dash-appbar-right">
          {hasWorldSession ? (
            <span className="dash-verified-pill">
              <span className="dash-verified-dot" aria-hidden="true" />
              World Verified
            </span>
          ) : null}
          {displayName ? (
            <span className="dash-appbar-user">{displayName}</span>
          ) : null}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — BALANCE CARD  (~148 px)
          ══════════════════════════════════════════════════ */}
      <section className="dash-balance-card" aria-label="Portfolio balance">
        {/* decorative glow */}
        <div className="dbc-glow dbc-glow-tl" aria-hidden="true" />
        <div className="dbc-glow dbc-glow-br" aria-hidden="true" />

        <div className="dbc-inner">
          {/* left: total KES */}
          <div className="dbc-total">
            <span className="dbc-label">Portfolio value</span>
            <strong className="dbc-number">{balanceLabel}</strong>
            <small className="dbc-sub">{balanceSublabel}</small>
          </div>

          {/* right: refresh + wallet link */}
          <div className="dbc-actions">
            <button
              type="button"
              className="dbc-refresh-btn"
              onClick={handleRefreshWallet}
              aria-label="Refresh wallet"
            >
              {walletRefreshing ? <span className="spin">↻</span> : "↻"}
            </button>
            <Link to="/wallet" className="dbc-wallet-link">Wallet →</Link>
          </div>
        </div>

        {/* asset row */}
        <div className="dbc-assets">
          <div className="dbc-asset dbc-asset-wld">
            <span className="dbc-asset-sym">W</span>
            <div className="dbc-asset-info">
              <span className="dbc-asset-label">WLD</span>
              <strong className="dbc-asset-val">{assetVal(walletBoard.wld)}</strong>
            </div>
            {homeMarketRates[0]?.priceKes > 1 ? (
              <span className="dbc-asset-rate">{formatKES(homeMarketRates[0].priceKes)}</span>
            ) : null}
          </div>
          <div className="dbc-asset dbc-asset-usdc">
            <span className="dbc-asset-sym">$</span>
            <div className="dbc-asset-info">
              <span className="dbc-asset-label">USDC</span>
              <strong className="dbc-asset-val">{assetVal(walletBoard.usdc)}</strong>
            </div>
            {homeMarketRates[1]?.priceKes > 1 ? (
              <span className="dbc-asset-rate">{formatKES(homeMarketRates[1].priceKes)}</span>
            ) : null}
          </div>
          <div className={`dbc-conn-pill${user?.walletAddress ? "" : " dbc-conn-none"}`}>
            <span className="dbc-conn-dot" aria-hidden="true" />
            {user?.walletAddress ? "Connected" : "No wallet"}
          </div>
        </div>

        {walletError && !hasWalletBalances ? (
          <div className="home-balance-error" style={{ margin: "0 0 2px" }}>{walletError}</div>
        ) : null}
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — QUICK ACTIONS  (~72 px)
          ══════════════════════════════════════════════════ */}
      <div className="dash-actions-row" role="navigation" aria-label="Quick actions">
        <Link to="/trade?tab=buy" className="dash-action dash-action-buy">
          <span className="dash-action-icon" aria-hidden="true">↑</span>
          <span className="dash-action-label">Buy</span>
        </Link>
        <Link to="/trade?tab=sell" className="dash-action dash-action-sell">
          <span className="dash-action-icon" aria-hidden="true">↓</span>
          <span className="dash-action-label">Sell</span>
        </Link>
        <Link to="/wallet#receive" className="dash-action dash-action-receive">
          <span className="dash-action-icon" aria-hidden="true">⬡</span>
          <span className="dash-action-label">Receive</span>
        </Link>
        <Link to="/orders" className="dash-action dash-action-history">
          <span className="dash-action-icon" aria-hidden="true">≡</span>
          <span className="dash-action-label">History</span>
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — LIVE MARKET PRICES  (~84 px)
          ══════════════════════════════════════════════════ */}
      <section className="dash-market-row" aria-label="Live prices">
        <div className="dash-market-head">
          <span className="dash-market-title">Market</span>
          <div className="dash-market-meta">
            {marketRefreshing
              ? <span className="dash-market-status">Syncing…</span>
              : hasLiveMarketRates
              ? <span className="dash-market-status live">● Live</span>
              : null}
            <button
              type="button"
              className="dbc-refresh-btn"
              onClick={handleRefreshRates}
              aria-label="Refresh prices"
            >
              {marketRefreshing ? <span className="spin">↻</span> : "↻"}
            </button>
          </div>
        </div>
        {marketRefreshError ? (
          <div className="error" style={{ fontSize: "0.82rem", padding: "8px 10px" }}>
            {marketRefreshError}
          </div>
        ) : (
          <div className="dash-market-tiles">
            {homeMarketRates.map((r) => (
              <div key={r.asset} className="dash-market-tile">
                <div className="dmt-head">
                  <span className="dmt-sym">{r.asset}</span>
                  <span className={`rate-live-dot${r.priceKes > 1 ? " live" : ""}`} aria-hidden="true" />
                </div>
                <strong className="dmt-price">
                  {r.priceKes > 1 ? formatKES(r.priceKes) : "—"}
                </strong>
                <span className="dmt-sub">per 1 {r.asset}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          SETUP NUDGE  (only when M-Pesa number missing)
          ══════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          SECTION 5 — RECENT ACTIVITY  (scrollable start)
          ══════════════════════════════════════════════════ */}
      {recentActivity.length ? (
        <section className="dash-activity-panel">
          <div className="dash-activity-head">
            <span className="dash-section-label">Recent orders</span>
            <Link to="/orders" className="dash-see-all">See all →</Link>
          </div>
          <div className="dash-activity-list">
            {recentActivity.map((order) => (
              <Link
                key={order.id}
                to="/orders"
                className="dash-activity-item"
              >
                <span className={`dash-type-badge dash-type-${order.type}`}>
                  {order.type === "buy" ? "Buy" : "Sell"}
                </span>
                <div className="dai-mid">
                  <strong className="dai-asset">
                    {order.cryptoAmount ? `${formatCryptoAmount(order.cryptoAmount)} ` : ""}
                    {order.asset}
                  </strong>
                  <small className="dai-date">{new Date(order.createdAt).toLocaleDateString()}</small>
                </div>
                <div className="dai-right">
                  <strong className="dai-kes">{formatKES(order.kesAmount)}</strong>
                  <small className="dai-status">
                    <span className={`activity-status-dot ${order.status}`} />
                    {statusLabel(order.status)}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ══════════════════════════════════════════════════════
          SECTION 6 — REFERRAL STRIP
          ══════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          SECTION 7 — HELP STRIP
          ══════════════════════════════════════════════════ */}
      <section className="panel home-help-strip">
        <span className="home-help-label">Need help?</span>
        <div className="home-help-actions">
          <Link to="/support" className="button-ghost home-help-btn">Guide</Link>
          <button
            type="button"
            className="button-secondary home-help-btn"
            onClick={() => openSupportEmail({
              subject: "TMpesa support request",
              body: `Hello TMpesa support,\n\nWorld username: ${user?.username ? `@${user.username}` : "N/A"}`,
            })}
          >
            Email
          </button>
          <button
            type="button"
            className="button-ghost home-help-btn"
            onClick={() => openWhatsAppSupport({
              message: `Hello TMpesa,\n\nI need help.\n\nWorld username: ${user?.username ? `@${user.username}` : "N/A"}`,
            })}
          >
            WhatsApp
          </button>
        </div>
      </section>

    </div>
  );
}

export default DashboardPage;
