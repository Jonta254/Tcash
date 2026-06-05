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
  const h = new Date().getHours();
  if (h < 5)  return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function statusLabel(s) {
  if (s === "paid")                      return "Reviewing";
  if (s === "completed")                 return "Completed";
  if (s === "rejected" || s === "cancelled") return "Failed";
  return "Pending";
}

function statusColor(s) {
  if (s === "completed")                 return "var(--success)";
  if (s === "paid")                      return "var(--primary)";
  if (s === "rejected" || s === "cancelled") return "var(--error)";
  return "var(--gold)";
}

export default function DashboardPage() {
  const initialUser      = getCurrentUser();
  const initialPortfolio = getCachedWorldWalletPortfolio(initialUser?.walletAddress);

  const [user,            setUser]            = useState(initialUser);
  const [profilePhone,    setProfilePhone]    = useState(initialUser?.mpesaPhoneNumber || initialUser?.phone || "");
  const [profileMessage,  setProfileMessage]  = useState("");
  const [profileError,    setProfileError]    = useState("");
  const [walletPortfolio, setWalletPortfolio] = useState(() => initialPortfolio);
  const [walletLoading,   setWalletLoading]   = useState(false);
  const [walletError,     setWalletError]     = useState("");
  const [mktError,        setMktError]        = useState("");
  const [mktRefreshing,   setMktRefreshing]   = useState(false);
  const [wltRefreshing,   setWltRefreshing]   = useState(false);
  const [referralSummary, setReferralSummary] = useState(() => getReferralSummary(initialUser));
  const [referralMsg,     setReferralMsg]     = useState("");
  const [referralErr,     setReferralErr]     = useState("");
  const liveRates = useExchangeRates();

  const recentOrders = useMemo(
    () => getOrdersForCurrentUser().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );

  const mktRates = useMemo(() => [
    { asset: "WLD",  kes: Number(liveRates?.WLD)  || 0 },
    { asset: "USDC", kes: Number(liveRates?.USDC) || 0 },
  ], [liveRates]);

  const hasLiveRates = mktRates.every(r => r.kes > 1);

  const walletBoard = useMemo(() => {
    const assets = walletPortfolio.assets.map(a => ({ ...a, marketPriceKes: Number(liveRates[a.symbol] || 0) }));
    return {
      assets,
      totalKes: calculateKesWalletBalance(assets, liveRates),
      wld:  assets.find(a => a.symbol === "WLD"),
      usdc: assets.find(a => a.symbol === "USDC"),
    };
  }, [liveRates, walletPortfolio.assets]);

  const hasBalances = useMemo(
    () => walletPortfolio.assets.some(a => Number(a.formattedBalance || 0) > 0),
    [walletPortfolio.assets],
  );

  const loadPortfolio = useCallback(async ({ showErrors = false } = {}) => {
    if (!user?.walletAddress) {
      setWalletPortfolio({ walletAddress: "", assets: [], supported: false });
      setWalletLoading(false);
      return;
    }
    setWalletLoading(true);
    setWalletError("");
    try {
      setWalletPortfolio(await getWorldWalletPortfolio(user.walletAddress));
    } catch (e) {
      const cached = getCachedWorldWalletPortfolio(user.walletAddress);
      if (cached.assets.length) setWalletPortfolio(cached);
      else {
        setWalletPortfolio({ walletAddress: user.walletAddress, assets: [], supported: true });
        if (showErrors) setWalletError(e instanceof Error ? e.message : "Unable to refresh wallet.");
      }
    } finally {
      setWalletLoading(false);
    }
  }, [user?.walletAddress]);

  useEffect(() => { loadPortfolio().catch(() => null); }, [loadPortfolio]);

  const normalizePhone = raw => {
    const c = raw.replace(/[\s-]/g, "");
    if (/^\+254[17]\d{8}$/.test(c)) return c.slice(1);
    if (/^254[17]\d{8}$/.test(c))   return `0${c.slice(3)}`;
    if (/^0[17]\d{8}$/.test(c))     return c;
    return null;
  };

  const handleSavePhone = () => {
    setProfileError(""); setProfileMessage("");
    if (!profilePhone.trim()) { setProfileError("Enter your M-Pesa number."); return; }
    const n = normalizePhone(profilePhone.trim());
    if (!n) { setProfileError("Use a valid Kenyan number e.g. 0712345678"); return; }
    setProfilePhone(n);
    setUser(updateCurrentUserProfile({ mpesaPhoneNumber: n }));
    haptic("success");
    setProfileMessage("Saved ✓");
  };

  const handleRefreshWallet = async () => {
    setWltRefreshing(true); haptic("light");
    try { await loadPortfolio({ showErrors: true }); }
    finally { setWltRefreshing(false); }
  };

  const handleRefreshRates = async () => {
    setMktError(""); setMktRefreshing(true); haptic("light");
    try { await fetchWorldMarketRates(); }
    catch (e) { if (!hasLiveRates) setMktError(e instanceof Error ? e.message : "Could not refresh."); }
    finally { setMktRefreshing(false); }
  };

  const handleShare = async () => {
    setReferralErr(""); setReferralMsg(""); haptic("medium");
    try {
      await shareMiniAppInvite({
        title: "Join TMpesa",
        text:  `Use code ${referralSummary.code} to trade WLD & USDC with M-Pesa in World App.`,
        url:   referralSummary.appLink,
      });
      setReferralSummary(markReferralShared(user));
      setReferralMsg("Shared!");
    } catch (e) { setReferralErr(e instanceof Error ? e.message : "Could not share."); }
  };

  const balanceLabel = useMemo(() => {
    if (!user?.walletAddress)          return "KES —";
    if (!hasLiveRates && !hasBalances) return "KES —";
    return formatKES(walletBoard.totalKes);
  }, [hasLiveRates, hasBalances, user?.walletAddress, walletBoard.totalKes]);

  const balanceSub = useMemo(() => {
    if (!user?.walletAddress)                                return "Connect World wallet to track";
    if (wltRefreshing || (walletLoading && !hasBalances))    return "Syncing…";
    if (walletError && !hasBalances)                         return "Sync failed · tap ↻";
    return "Total portfolio in KES";
  }, [hasBalances, user?.walletAddress, walletError, walletLoading, wltRefreshing]);

  const assetAmt = useCallback(entry => {
    if (entry) return formatCryptoAmount(entry.formattedBalance);
    if (!user?.walletAddress || walletLoading) return "—";
    return "0";
  }, [user?.walletAddress, walletLoading]);

  const greeting    = getGreeting();
  const displayName = user?.username ? `@${user.username}` : user?.fullName || null;
  const hasWorld    = Boolean(user?.username);
  const initials    = (user?.username || user?.fullName || "T")[0].toUpperCase();

  return (
    <div className="home-root page-enter">

      {/* ════════════════════════════════════════════
          HERO CARD — brand + greeting + balance + actions
          ════════════════════════════════════════════ */}
      <div className="home-hero">
        {/* ambient glows */}
        <div className="hh-glow hh-glow-a" aria-hidden="true" />
        <div className="hh-glow hh-glow-b" aria-hidden="true" />
        <div className="hh-glow hh-glow-c" aria-hidden="true" />

        {/* ── top row: brand + avatar ── */}
        <div className="hh-toprow">
          <div className="hh-brand">
            <span className="hh-brand-mark" aria-hidden="true">M</span>
            <span className="hh-brand-name">TMpesa</span>
            {hasWorld && (
              <span className="hh-verified-chip">
                <span className="hh-verified-dot" aria-hidden="true" />
                World
              </span>
            )}
          </div>
          <Link to="/profile" className="hh-avatar" aria-label="Profile">
            {initials}
          </Link>
        </div>

        {/* ── greeting + balance ── */}
        <div className="hh-balance-section">
          <p className="hh-greeting">
            {greeting}{displayName ? `, ${displayName}` : ""}
          </p>
          <div className="hh-balance-row">
            <strong className="hh-balance-num">{balanceLabel}</strong>
            <button
              type="button"
              className="hh-refresh-btn"
              onClick={handleRefreshWallet}
              aria-label="Refresh"
            >
              <span className={wltRefreshing ? "spin" : ""}>↻</span>
            </button>
          </div>
          <div className="hh-balance-meta">
            <span className="hh-balance-sub">{balanceSub}</span>
            <Link to="/wallet" className="hh-wallet-link">Wallet →</Link>
          </div>
          {walletError && !hasBalances && (
            <div className="hh-wallet-err">{walletError}</div>
          )}
        </div>

        {/* ── asset chips ── */}
        <div className="hh-assets">
          <div className="hh-asset hh-asset-wld">
            <span className="hh-asset-sym">W</span>
            <div className="hh-asset-body">
              <span className="hh-asset-name">WLD</span>
              <strong className="hh-asset-amt">{assetAmt(walletBoard.wld)}</strong>
            </div>
            {mktRates[0].kes > 1 && (
              <span className="hh-asset-rate">{formatKES(mktRates[0].kes)}</span>
            )}
          </div>
          <div className="hh-asset hh-asset-usdc">
            <span className="hh-asset-sym">$</span>
            <div className="hh-asset-body">
              <span className="hh-asset-name">USDC</span>
              <strong className="hh-asset-amt">{assetAmt(walletBoard.usdc)}</strong>
            </div>
            {mktRates[1].kes > 1 && (
              <span className="hh-asset-rate">{formatKES(mktRates[1].kes)}</span>
            )}
          </div>
          <div className={`hh-conn-pill${user?.walletAddress ? "" : " hh-conn-none"}`}>
            <span className="hh-conn-dot" aria-hidden="true" />
            {user?.walletAddress ? "Connected" : "No wallet"}
          </div>
        </div>

        {/* ── divider ── */}
        <div className="hh-divider" aria-hidden="true" />

        {/* ── quick actions ── */}
        <nav className="hh-actions" aria-label="Quick actions">
          <Link to="/trade?tab=buy"  className="hh-action hh-action-buy">
            <span className="hh-action-icon">↑</span>
            <span className="hh-action-label">Buy</span>
          </Link>
          <Link to="/trade?tab=sell" className="hh-action hh-action-sell">
            <span className="hh-action-icon">↓</span>
            <span className="hh-action-label">Sell</span>
          </Link>
          <Link to="/wallet#receive" className="hh-action hh-action-receive">
            <span className="hh-action-icon">⬡</span>
            <span className="hh-action-label">Receive</span>
          </Link>
          <Link to="/orders"         className="hh-action hh-action-history">
            <span className="hh-action-icon">◷</span>
            <span className="hh-action-label">History</span>
          </Link>
        </nav>
      </div>

      {/* ════════════════════════════════════════════
          MARKET RATES
          ════════════════════════════════════════════ */}
      <section className="home-market" aria-label="Live prices">
        <div className="hm-head">
          <span className="hm-title">Market</span>
          <div className="hm-meta">
            {mktRefreshing
              ? <span className="hm-live-dot syncing" />
              : hasLiveRates
              ? <span className="hm-live-dot" />
              : null}
            {hasLiveRates && !mktRefreshing && <span className="hm-live-label">Live</span>}
            <button type="button" className="hh-refresh-btn" onClick={handleRefreshRates} aria-label="Refresh prices">
              <span className={mktRefreshing ? "spin" : ""}>↻</span>
            </button>
          </div>
        </div>
        {mktError && <div className="error" style={{ fontSize: "0.8rem" }}>{mktError}</div>}
        <div className="hm-tiles">
          {mktRates.map(r => (
            <div key={r.asset} className={`hm-tile hm-tile-${r.asset.toLowerCase()}`}>
              <div className="hmt-sym-row">
                <span className="hmt-sym">{r.asset}</span>
                <span className={`hmt-dot${r.kes > 1 ? " live" : ""}`} aria-hidden="true" />
              </div>
              <strong className="hmt-price">{r.kes > 1 ? formatKES(r.kes) : "—"}</strong>
              <span className="hmt-label">per 1 {r.asset}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SETUP NUDGE (M-Pesa number missing)
          ════════════════════════════════════════════ */}
      {!user?.isAdmin && !user?.mpesaPhoneNumber && (
        <section className="home-nudge">
          <div className="nudge-head">
            <span className="nudge-icon" aria-hidden="true">📲</span>
            <div>
              <strong>Add M-Pesa number</strong>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                Required for sell payouts and referral rewards.
              </p>
            </div>
          </div>
          {profileError   && <div className="error">{profileError}</div>}
          {profileMessage && <div className="notice">{profileMessage}</div>}
          <div className="nudge-row">
            <input
              value={profilePhone}
              onChange={e => setProfilePhone(e.target.value)}
              placeholder="e.g. 0712345678"
              inputMode="tel"
              aria-label="M-Pesa payout number"
            />
            <button type="button" className="button" onClick={handleSavePhone}>Save</button>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          RECENT ORDERS
          ════════════════════════════════════════════ */}
      {recentOrders.length > 0 && (
        <section className="home-activity">
          <div className="ha-head">
            <span className="ha-title">Recent orders</span>
            <Link to="/orders" className="ha-see-all">See all →</Link>
          </div>
          <div className="ha-list">
            {recentOrders.map(o => (
              <Link key={o.id} to="/orders" className="ha-item">
                <span className={`ha-type ha-type-${o.type}`}>
                  {o.type === "buy" ? "↑" : "↓"}
                </span>
                <div className="ha-mid">
                  <strong className="ha-asset">
                    {o.cryptoAmount ? `${formatCryptoAmount(o.cryptoAmount)} ` : ""}{o.asset}
                  </strong>
                  <small className="ha-date">{new Date(o.createdAt).toLocaleDateString()}</small>
                </div>
                <div className="ha-right">
                  <strong className="ha-kes">{formatKES(o.kesAmount)}</strong>
                  <small className="ha-status" style={{ color: statusColor(o.status) }}>
                    {statusLabel(o.status)}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          REFERRAL + HELP
          ════════════════════════════════════════════ */}
      <section className="home-referral">
        <div className="hr-left">
          <span className="hr-icon" aria-hidden="true">🎁</span>
          <div>
            <strong>Invite &amp; earn</strong>
            <p className="muted">
              Code <span className="hr-code">{referralSummary.code}</span>
            </p>
          </div>
        </div>
        <div className="hr-right">
          {referralMsg && <small style={{ color: "var(--success)" }}>{referralMsg}</small>}
          {referralErr && <small style={{ color: "var(--error)" }}>{referralErr}</small>}
          <button type="button" className="button" style={{ padding: "8px 18px", fontSize: "0.82rem" }} onClick={handleShare}>
            Share
          </button>
        </div>
      </section>

      <section className="home-help">
        <span className="home-help-label">Need help?</span>
        <div className="home-help-actions">
          <Link to="/support" className="button-ghost home-help-btn">Guide</Link>
          <button
            type="button"
            className="button-secondary home-help-btn"
            onClick={() => openSupportEmail({ subject: "TMpesa support", body: `World: ${user?.username ? `@${user.username}` : "N/A"}` })}
          >
            Email
          </button>
          <button
            type="button"
            className="button-ghost home-help-btn"
            onClick={() => openWhatsAppSupport({ message: `Hello TMpesa,\n\nI need help.\n\nWorld: ${user?.username ? `@${user.username}` : "N/A"}` })}
          >
            WhatsApp
          </button>
        </div>
      </section>

    </div>
  );
}
